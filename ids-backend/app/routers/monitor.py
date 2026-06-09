"""
Monitoreo: estadísticas de tráfico desde ClickHouse (series temporales).
Coincide con monitorService del frontend.

Devuelve tres bloques para la página de Monitoreo:
  - traffic   : serie temporal de tráfico normal vs malicioso (gráfico verde/rojo)
  - alerts    : conteo de alertas por intervalo
  - protocols : distribución por protocolo
Todo tolera ClickHouse vacío o no disponible → devuelve estructuras vacías.
"""
from fastapi import APIRouter, Depends, Query

from app.db.clickhouse import get_client
from app.config import settings
from app.routers.auth import current_user

router = APIRouter(prefix="/monitor", tags=["monitor"])
DB = settings.CLICKHOUSE_DB


@router.get("/stats")
def get_stats(minutes: int = Query(60, le=1440), _=Depends(current_user)):
    """Tráfico normal vs malicioso por minuto (para el gráfico en vivo)."""
    try:
        client = get_client()
        rows = client.query(f"""
            SELECT toStartOfMinute(ts)        AS minuto,
                   sum(flujos_normales)       AS normales,
                   sum(flujos_maliciosos)     AS maliciosos,
                   sum(packets)               AS packets
            FROM {DB}.traffic_raw
            WHERE ts >= now() - INTERVAL {int(minutes)} MINUTE
            GROUP BY minuto
            ORDER BY minuto
        """).result_rows

        series = [
            {
                "ts": r[0].strftime("%H:%M"),
                "normales": int(r[1]),
                "maliciosos": int(r[2]),
                "packets": int(r[3]),
            }
            for r in rows
        ]
        return {"series": series, "total_points": len(series)}
    except Exception:
        return {"series": [], "total_points": 0}


@router.get("/alerts-timeline")
def alerts_timeline(hours: int = Query(24, le=720), _=Depends(current_user)):
    """Conteo de alertas por hora, separado por severidad."""
    try:
        client = get_client()
        rows = client.query(f"""
            SELECT toStartOfHour(ts)  AS hora,
                   severity,
                   sum(count)         AS total
            FROM {DB}.alert_counts
            WHERE ts >= now() - INTERVAL {int(hours)} HOUR
            GROUP BY hora, severity
            ORDER BY hora
        """).result_rows
        data = [
            {"ts": r[0].strftime("%H:%M"), "severity": str(r[1]), "count": int(r[2])}
            for r in rows
        ]
        return {"series": data, "total_points": len(data)}
    except Exception:
        return {"series": [], "total_points": 0}


@router.get("/protocols")
def protocol_distribution(hours: int = Query(24, le=720), _=Depends(current_user)):
    """Distribución de tráfico por protocolo (para gráfico de torta/barras)."""
    try:
        client = get_client()
        rows = client.query(f"""
            SELECT protocol,
                   sum(packets)  AS packets,
                   sum(bytes)    AS bytes
            FROM {DB}.protocol_stats
            WHERE ts >= now() - INTERVAL {int(hours)} HOUR
            GROUP BY protocol
            ORDER BY packets DESC
        """).result_rows
        data = [
            {"protocol": str(r[0]), "packets": int(r[1]), "bytes": int(r[2])}
            for r in rows
        ]
        return {"protocols": data}
    except Exception:
        return {"protocols": []}
