"""
Conexión a ClickHouse.
Almacena series temporales de alto volumen para los gráficos del dashboard.
ClickHouse es columnar → las agregaciones por tiempo son muy rápidas.

Estrategia de retención (downsampling):
  - traffic_raw      : tráfico crudo de alta resolución, se borra a los 7 días (TTL).
  - traffic_hourly   : resumen horario, se llena SOLO vía materialized view, 90 días.
  - alert_counts     : conteo de alertas agregado, 90 días.
  - protocol_stats   : estadísticas por protocolo/IP, 90 días.
"""
import clickhouse_connect
from clickhouse_connect.driver.client import Client

from app.config import settings

_client: Client | None = None


def get_client() -> Client:
    
    global _client
    if _client is None:
        _client = clickhouse_connect.get_client(
            host=settings.CLICKHOUSE_HOST,
            port=settings.CLICKHOUSE_PORT,
            username=settings.CLICKHOUSE_USER,
            password=settings.CLICKHOUSE_PASSWORD,
        )
    return _client


def init_clickhouse():
    
    try:
        client = get_client()
        db = settings.CLICKHOUSE_DB
        client.command(f"CREATE DATABASE IF NOT EXISTS {db}")

        # ── Tabla 1: tráfico crudo (alimenta el gráfico en vivo verde/rojo) ──────
        # Retención 7 días: TTL borra automáticamente las filas más viejas.
        client.command(f"""
            CREATE TABLE IF NOT EXISTS {db}.traffic_raw (
                ts                 DateTime,
                packets            UInt64,
                bytes              UInt64,
                flujos_normales    UInt32,
                flujos_maliciosos  UInt32,
                protocol           LowCardinality(String),
                segmento           LowCardinality(String) DEFAULT 'datos'
            ) ENGINE = MergeTree()
            ORDER BY (ts, protocol)
            TTL ts + INTERVAL 7 DAY
        """)
        # Migración idempotente: si la tabla ya existía sin 'segmento', se agrega.
        try:
            client.command(
                f"ALTER TABLE {db}.traffic_raw "
                f"ADD COLUMN IF NOT EXISTS segmento LowCardinality(String) DEFAULT 'datos'"
            )
        except Exception:
            pass

        # ── Tabla 2: conteo de alertas agregado (90 días) ────────────────────────
        client.command(f"""
            CREATE TABLE IF NOT EXISTS {db}.alert_counts (
                ts            DateTime,
                severity      LowCardinality(String),
                tipo_ataque   LowCardinality(String),
                count         UInt32
            ) ENGINE = MergeTree()
            ORDER BY (ts, severity, tipo_ataque)
            TTL ts + INTERVAL 90 DAY
        """)

        # ── Tabla 3: estadísticas por protocolo / IP (90 días) ───────────────────
        client.command(f"""
            CREATE TABLE IF NOT EXISTS {db}.protocol_stats (
                ts            DateTime,
                protocol      LowCardinality(String),
                src_ip        String,
                packets       UInt64,
                bytes         UInt64
            ) ENGINE = MergeTree()
            ORDER BY (ts, protocol)
            TTL ts + INTERVAL 90 DAY
        """)

        # ── Tabla 4: resumen horario de tráfico (downsampling, 90 días) ──────────
        # Usa SummingMergeTree: suma automáticamente las filas con la misma clave.
        client.command(f"""
            CREATE TABLE IF NOT EXISTS {db}.traffic_hourly (
                hora               DateTime,
                packets            UInt64,
                bytes              UInt64,
                flujos_normales    UInt64,
                flujos_maliciosos  UInt64
            ) ENGINE = SummingMergeTree()
            ORDER BY (hora)
            TTL hora + INTERVAL 90 DAY
        """)

        # ── Materialized view: llena traffic_hourly automáticamente ──────────────
        # Cada inserción en traffic_raw se agrega por hora en traffic_hourly.
        # Así, aunque traffic_raw se borre a los 7 días, el resumen sobrevive 90.
        client.command(f"""
            CREATE MATERIALIZED VIEW IF NOT EXISTS {db}.traffic_hourly_mv
            TO {db}.traffic_hourly
            AS
            SELECT
                toStartOfHour(ts)         AS hora,
                sum(packets)              AS packets,
                sum(bytes)                AS bytes,
                sum(flujos_normales)      AS flujos_normales,
                sum(flujos_maliciosos)    AS flujos_maliciosos
            FROM {db}.traffic_raw
            GROUP BY hora
        """)

        print("[clickhouse] base, tablas y materialized view listas")
    except Exception as e:
        print(f"[clickhouse] no se pudo inicializar (arranca igual): {e}")
