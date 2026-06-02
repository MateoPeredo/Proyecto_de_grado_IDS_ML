"""
Monitoreo: coincide con monitorService del frontend.
Las estadísticas de tráfico salen de ClickHouse (agregaciones por tiempo).
"""
from fastapi import APIRouter, Depends

from app.db.clickhouse import get_client
from app.config import settings
from app.routers.auth import current_user

router = APIRouter(prefix="/monitor", tags=["monitor"])


@router.get("/stats")
def get_stats(_=Depends(current_user)):
    try:
        client = get_client()
        # Tráfico de la última hora agregado por minuto (para el gráfico de líneas)
        rows = client.query(f"""
            SELECT toStartOfMinute(ts) AS minute,
                   sum(packets)        AS packets,
                   sum(bytes)          AS bytes
            FROM {settings.CLICKHOUSE_DB}.traffic_stats
            WHERE ts >= now() - INTERVAL 1 HOUR
            GROUP BY minute
            ORDER BY minute
        """).result_rows

        series = [
            {"ts": str(r[0]), "packets": int(r[1]), "bytes": int(r[2])}
            for r in rows
        ]
        return {"series": series, "total_points": len(series)}
    except Exception:
        # ClickHouse vacío o no disponible → estructura vacía
        return {"series": [], "total_points": 0}
