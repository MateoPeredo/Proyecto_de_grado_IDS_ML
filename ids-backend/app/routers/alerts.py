"""
Alertas: coincide con alertsService del frontend.
Las alertas viven en Elasticsearch (búsqueda y filtrado flexible).
"""
from fastapi import APIRouter, Depends, Query

from app.db.elastic import get_client, INDEX_ALERTS
from app.routers.auth import current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def get_alerts(
    limit: int = Query(50, le=500),
    severity: str | None = None,
    _=Depends(current_user),
):
    es = get_client()
    query = {"match_all": {}} if not severity else {"term": {"severity": severity}}
    try:
        res = es.search(
            index=INDEX_ALERTS,
            query=query,
            size=limit,
            sort=[{"ts": {"order": "desc"}}],
        )
        hits = res.get("hits", {}).get("hits", [])
        return [{"id": h["_id"], **h["_source"]} for h in hits]
    except Exception:
        # índice vacío o ES no disponible → lista vacía en vez de error 500
        return []


@router.patch("/{alert_id}/ack")
def acknowledge(alert_id: str, _=Depends(current_user)):
    es = get_client()
    es.update(index=INDEX_ALERTS, id=alert_id, doc={"acknowledged": True})
    return {"ok": True, "id": alert_id}


@router.post("/ack-all")
def acknowledge_all(_=Depends(current_user)):
    es = get_client()
    es.update_by_query(
        index=INDEX_ALERTS,
        query={"term": {"acknowledged": False}},
        script={"source": "ctx._source.acknowledged = true"},
    )
    return {"ok": True}
