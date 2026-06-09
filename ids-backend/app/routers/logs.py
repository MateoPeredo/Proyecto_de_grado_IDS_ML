"""
Logs: consulta y búsqueda sobre los índices de Elasticsearch.
  - /logs/plataforma : eventos operativos
  - /logs/deteccion  : decisiones del motor de detección
  - /logs/trafico    : detalle de flujos capturados (con filtros de búsqueda)

Todo tolera Elasticsearch vacío o no disponible → devuelve listas vacías.
"""
from fastapi import APIRouter, Depends, Query

from app.db.elastic import (
    get_client, INDEX_LOG_PLATAFORMA, INDEX_LOG_DETECCION, INDEX_TRAFICO,
)
from app.routers.auth import current_user

router = APIRouter(prefix="/logs", tags=["logs"])


def _buscar(index: str, query: dict, limit: int):
    """Helper: ejecuta una búsqueda ordenada por timestamp desc."""
    try:
        es = get_client()
        res = es.search(
            index=index,
            query=query,
            size=limit,
            sort=[{"timestamp": {"order": "desc"}}],
        )
        hits = res.get("hits", {}).get("hits", [])
        return [{"id": h["_id"], **h["_source"]} for h in hits]
    except Exception:
        return []


@router.get("/plataforma")
def logs_plataforma(
    limit: int = Query(100, le=1000),
    nivel: str | None = None,
    _=Depends(current_user),
):
    query = {"match_all": {}} if not nivel else {"term": {"nivel": nivel}}
    return _buscar(INDEX_LOG_PLATAFORMA, query, limit)


@router.get("/deteccion")
def logs_deteccion(
    limit: int = Query(100, le=1000),
    motor: str | None = None,
    _=Depends(current_user),
):
    query = {"match_all": {}} if not motor else {"term": {"motor": motor}}
    return _buscar(INDEX_LOG_DETECCION, query, limit)


@router.get("/trafico")
def logs_trafico(
    limit: int = Query(100, le=1000),
    ip: str | None = Query(None, description="filtra por IP origen o destino"),
    protocolo: str | None = None,
    clasificacion: str | None = None,
    _=Depends(current_user),
):
    
    must = []
    if ip:
        must.append({"bool": {"should": [
            {"term": {"ip_origen": ip}},
            {"term": {"ip_destino": ip}},
        ]}})
    if protocolo:
        must.append({"term": {"protocolo": protocolo}})
    if clasificacion:
        must.append({"term": {"clasificacion": clasificacion}})

    query = {"match_all": {}} if not must else {"bool": {"must": must}}
    return _buscar(INDEX_TRAFICO, query, limit)
