"""
Conexión a Elasticsearch.
Guarda documentos con búsqueda full-text y filtrado flexible:
logs de la plataforma, metadatos de captura de tráfico y el detalle de alertas.
"""
from elasticsearch import Elasticsearch

from app.config import settings

_client: Elasticsearch | None = None

# Índices que usa la plataforma
INDEX_LOGS = "ids-logs"
INDEX_TRAFFIC = "ids-traffic"
INDEX_ALERTS = "ids-alerts"


def get_client() -> Elasticsearch:
    """Devuelve un cliente Elasticsearch (singleton perezoso)."""
    global _client
    if _client is None:
        auth = None
        if settings.ELASTIC_USER:
            auth = (settings.ELASTIC_USER, settings.ELASTIC_PASSWORD)
        _client = Elasticsearch(
            settings.ELASTIC_HOST,
            basic_auth=auth,
            request_timeout=10,
        )
    return _client


def init_elastic():
    """Crea los índices si no existen."""
    try:
        es = get_client()
        for index in (INDEX_LOGS, INDEX_TRAFFIC, INDEX_ALERTS):
            if not es.indices.exists(index=index):
                es.indices.create(index=index)
        print("[elastic] índices listos")
    except Exception as e:
        print(f"[elastic] no se pudo inicializar (arranca igual): {e}")
