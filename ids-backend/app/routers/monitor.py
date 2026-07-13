"""
Monitoreo: estadísticas de tráfico desde ClickHouse (series temporales) y
resúmenes para Dashboard desde MySQL.
"""
from fastapi import APIRouter, Depends, Query

from app.db.clickhouse import get_client
from app.config import settings
from app.routers.auth import current_user

router = APIRouter(prefix="/monitor", tags=["monitor"])
DB = settings.CLICKHOUSE_DB


@router.get("/stats")
def get_stats(minutes: int = Query(10, le=1440), segmento: str | None = None,
              _=Depends(current_user)):
    """Tráfico por intervalos de 10 segundos (para el gráfico en vivo, fluido).
    Agrupa cada 10s en vez de por minuto: muchos más puntos = curva que avanza
    seguido, se ve en tiempo real. Convierte a hora local, rellena los intervalos
    sin datos con 0, y descarta el intervalo en curso (incompleto).
    Devuelve normales, maliciosos (ataques reales) y descartados (falsos positivos)."""
    TZ = "America/La_Paz"   
    PASO = 5               # segundos por punto
    try:
        client = get_client()
        filtro_seg = ""
        if segmento and segmento != "todos":
            seg = segmento.replace("'", "")   # saneo básico
            filtro_seg = f"AND segmento = '{seg}'"
        # toStartOfInterval agrupa en bloques de 10 segundos.
        rows = client.query(f"""
            SELECT toStartOfInterval(toTimeZone(ts, '{TZ}'), INTERVAL {PASO} SECOND) AS t,
                   sum(flujos_normales)       AS normales,
                   sum(flujos_maliciosos)     AS maliciosos,
                   sum(flujos_descartados)    AS descartados,
                   sum(packets)               AS packets
            FROM {DB}.traffic_raw
            WHERE ts >= now() - INTERVAL {int(minutes)} MINUTE
              AND ts <  toStartOfInterval(now(), INTERVAL {PASO} SECOND)   {filtro_seg}
            GROUP BY t
            ORDER BY t
            WITH FILL
                FROM toStartOfInterval(toTimeZone(now() - INTERVAL {int(minutes)} MINUTE, '{TZ}'), INTERVAL {PASO} SECOND)
                TO   toStartOfInterval(toTimeZone(now(), '{TZ}'), INTERVAL {PASO} SECOND)
                STEP INTERVAL {PASO} SECOND
        """).result_rows
        series = [
            {"ts": r[0].strftime("%H:%M:%S"), "normales": int(r[1]),
             "maliciosos": int(r[2]), "descartados": int(r[3]), "packets": int(r[4])}
            for r in rows
        ]
        return {"series": series, "total_points": len(series)}
    except Exception:
        return {"series": [], "total_points": 0}


@router.get("/sensores")
def estado_sensores(_=Depends(current_user)):
    """Estado (activo/inactivo) de cada sensor por segmento, según su último
    latido. Activo si latió en los últimos 30 s. Solo lectura."""
    from datetime import datetime, timedelta
    from app.db.mysql import SessionLocal
    from app.models.sensor_estado import SensorEstado
    db = SessionLocal()
    try:
        limite = datetime.now() - timedelta(seconds=30)
        filas = db.query(SensorEstado).all()
        return {"sensores": [
            {
                "segmento": f.segmento,
                "interfaz": f.interfaz,
                "activo": bool(f.ultimo_latido and f.ultimo_latido >= limite),
                "ultimo_latido": f.ultimo_latido.isoformat() if f.ultimo_latido else None,
            }
            for f in filas
        ]}
    except Exception:
        return {"sensores": []}
    finally:
        db.close()


@router.get("/alerts-timeline")
def alerts_timeline(hours: int = Query(24, le=720), _=Depends(current_user)):
    """Conteo de alertas por hora, separado por severidad."""
    try:
        client = get_client()
        rows = client.query(f"""
            SELECT toStartOfHour(ts)  AS hora, severity, sum(count) AS total
            FROM {DB}.alert_counts
            WHERE ts >= now() - INTERVAL {int(hours)} HOUR
            GROUP BY hora, severity
            ORDER BY hora
        """).result_rows
        data = [{"ts": r[0].strftime("%H:%M"), "severity": str(r[1]), "count": int(r[2])} for r in rows]
        return {"series": data, "total_points": len(data)}
    except Exception:
        return {"series": [], "total_points": 0}


@router.get("/protocols")
def protocol_distribution(hours: int = Query(24, le=720), _=Depends(current_user)):
    """Distribución por protocolo desde protocol_stats (legacy)."""
    try:
        client = get_client()
        rows = client.query(f"""
            SELECT protocol, sum(packets) AS packets, sum(bytes) AS bytes
            FROM {DB}.protocol_stats
            WHERE ts >= now() - INTERVAL {int(hours)} HOUR
            GROUP BY protocol ORDER BY packets DESC
        """).result_rows
        data = [{"protocol": str(r[0]), "packets": int(r[1]), "bytes": int(r[2])} for r in rows]
        return {"protocols": data}
    except Exception:
        return {"protocols": []}


# ══════════════════════════════════════════════════════════════════════════════
#  Endpoints para Dashboard y Monitoreo (leen datos REALES)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/protocolos-trafico")
def protocolos_desde_trafico(minutes: int = Query(60, le=10080), _=Depends(current_user)):
    """Distribución por protocolo leída de traffic_raw (que SÍ se llena)."""
    try:
        client = get_client()
        rows = client.query(f"""
            SELECT protocol, sum(packets) AS packets, sum(bytes) AS bytes
            FROM {DB}.traffic_raw
            WHERE ts >= now() - INTERVAL {int(minutes)} MINUTE
            GROUP BY protocol ORDER BY packets DESC
        """).result_rows
        data = [{"protocol": str(r[0]), "packets": int(r[1]), "bytes": int(r[2])} for r in rows]
        return {"protocols": data}
    except Exception:
        return {"protocols": []}


@router.get("/resumen")
def resumen_dashboard(_=Depends(current_user)):
    """Resumen general de tráfico (ClickHouse) de las últimas 24h."""
    resultado = {
        "paquetes_24h": 0, "flujos_normales_24h": 0, "flujos_maliciosos_24h": 0,
        "pct_malicioso": 0.0, "protocolos_activos": 0,
    }
    try:
        client = get_client()
        row = client.query(f"""
            SELECT sum(packets), sum(flujos_normales), sum(flujos_maliciosos), uniqExact(protocol)
            FROM {DB}.traffic_raw
            WHERE ts >= now() - INTERVAL 24 HOUR
        """).result_rows
        if row and row[0][0] is not None:
            paquetes = int(row[0][0] or 0)
            normales = int(row[0][1] or 0)
            maliciosos = int(row[0][2] or 0)
            protos = int(row[0][3] or 0)
            total_flujos = normales + maliciosos
            resultado.update({
                "paquetes_24h": paquetes,
                "flujos_normales_24h": normales,
                "flujos_maliciosos_24h": maliciosos,
                "pct_malicioso": round(100 * maliciosos / total_flujos, 1) if total_flujos else 0.0,
                "protocolos_activos": protos,
            })
    except Exception:
        pass
    return resultado


@router.get("/tipos-ataque")
def tipos_de_ataque(_=Depends(current_user)):
    """Distribución de alertas por tipo de ataque (desde MySQL)."""
    from app.db.mysql import SessionLocal
    from app.models.alert import Alert
    from sqlalchemy import func
    db = SessionLocal()
    try:
        rows = (
            db.query(Alert.signature_name, func.count(Alert.id))
            .group_by(Alert.signature_name)
            .order_by(func.count(Alert.id).desc())
            .limit(10).all()
        )
        return {"tipos": [{"nombre": str(n), "count": int(c)} for n, c in rows]}
    except Exception:
        return {"tipos": []}
    finally:
        db.close()


@router.get("/top-atacantes")
def top_atacantes(_=Depends(current_user)):
    """Top 10 IPs de origen con más alertas (desde MySQL)."""
    from app.db.mysql import SessionLocal
    from app.models.alert import Alert
    from sqlalchemy import func
    db = SessionLocal()
    try:
        rows = (
            db.query(Alert.source_ip, func.count(Alert.id))
            .filter(Alert.source_ip.isnot(None))
            .group_by(Alert.source_ip)
            .order_by(func.count(Alert.id).desc())
            .limit(10).all()
        )
        return {"atacantes": [{"ip": str(ip), "count": int(c)} for ip, c in rows]}
    except Exception:
        return {"atacantes": []}
    finally:
        db.close()


@router.get("/verificacion-ml")
def verificacion_ml(_=Depends(current_user)):
    """Resumen del double-check: confirmadas por ML vs solo firma."""
    from app.db.mysql import SessionLocal
    from app.models.alert import Alert
    from sqlalchemy import func
    db = SessionLocal()
    try:
        rows = db.query(Alert.detected_by, func.count(Alert.id)).group_by(Alert.detected_by).all()
        data = {str(k): int(v) for k, v in rows}
        return {
            "confirmadas_ml": data.get("firma+ml", 0),
            "solo_firma": data.get("firma", 0),
            "detalle": [{"origen": k, "count": v} for k, v in data.items()],
        }
    except Exception:
        return {"confirmadas_ml": 0, "solo_firma": 0, "detalle": []}
    finally:
        db.close()
