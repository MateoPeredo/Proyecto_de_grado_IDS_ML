"""
Conexión a ClickHouse.
Almacena series temporales de alto volumen para los gráficos del dashboard:
tráfico por segundo, conteo de alertas por minuto, throughput, etc.
ClickHouse es columnar → las agregaciones por tiempo son muy rápidas.
"""
import clickhouse_connect
from clickhouse_connect.driver.client import Client

from app.config import settings

_client: Client | None = None


def get_client() -> Client:
    """Devuelve un cliente ClickHouse (singleton perezoso)."""
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
    """Crea la base y las tablas de métricas si no existen."""
    try:
        client = get_client()
        client.command(f"CREATE DATABASE IF NOT EXISTS {settings.CLICKHOUSE_DB}")

        # Tabla de tráfico: una fila por ventana de tiempo
        client.command(f"""
            CREATE TABLE IF NOT EXISTS {settings.CLICKHOUSE_DB}.traffic_stats (
                ts            DateTime,
                packets       UInt64,
                bytes         UInt64,
                protocol      LowCardinality(String),
                src_ip        String,
                dst_ip        String
            ) ENGINE = MergeTree()
            ORDER BY (ts, protocol)
        """)

        # Tabla de conteo de alertas por severidad (para los gráficos de barras)
        client.command(f"""
            CREATE TABLE IF NOT EXISTS {settings.CLICKHOUSE_DB}.alert_counts (
                ts            DateTime,
                severity      LowCardinality(String),
                count         UInt32
            ) ENGINE = MergeTree()
            ORDER BY (ts, severity)
        """)
        print("[clickhouse] base y tablas listas")
    except Exception as e:
        print(f"[clickhouse] no se pudo inicializar (arranca igual): {e}")
