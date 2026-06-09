"""
Conexión a Elasticsearch.
Guarda documentos con búsqueda full-text y filtrado flexible:
  - ids-logs-plataforma : eventos operativos (login, reglas, sistema)
  - ids-logs-deteccion  : qué analizó el motor (firma/ML) y qué decidió
  - ids-trafico         : detalle de cada flujo capturado (para búsqueda)

Retención: limpieza programada simple (no ILM). Una función borra los
documentos más antiguos que RETENCION_DIAS, y se invoca periódicamente.
"""
from datetime import datetime, timezone, timedelta

from elasticsearch import Elasticsearch

from app.config import settings

_client: Elasticsearch | None = None


INDEX_LOG_PLATAFORMA = "ids-logs-plataforma"
INDEX_LOG_DETECCION  = "ids-logs-deteccion"
INDEX_TRAFICO        = "ids-trafico"

TODOS_LOS_INDICES = (INDEX_LOG_PLATAFORMA, INDEX_LOG_DETECCION, INDEX_TRAFICO)


RETENCION_DIAS = 14


MAPEOS = {
    INDEX_LOG_PLATAFORMA: {
        "properties": {
            "timestamp": {"type": "date"},
            "nivel":     {"type": "keyword"},
            "evento":    {"type": "keyword"},
            "usuario":   {"type": "keyword"},
            "mensaje":   {"type": "text"},
        }
    },
    INDEX_LOG_DETECCION: {
        "properties": {
            "timestamp":   {"type": "date"},
            "motor":       {"type": "keyword"}, 
            "resultado":   {"type": "keyword"},  
            "confianza":   {"type": "float"},
            "detalle":     {"type": "text"},
        }
    },
    INDEX_TRAFICO: {
        "properties": {
            "timestamp":      {"type": "date"},
            "ip_origen":      {"type": "ip"},
            "ip_destino":     {"type": "ip"},
            "puerto_origen":  {"type": "integer"},
            "puerto_destino": {"type": "integer"},
            "protocolo":      {"type": "keyword"},
            "bytes":          {"type": "long"},
            "paquetes":       {"type": "long"},
            "clasificacion":  {"type": "keyword"}, 
        }
    },
}


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
    """Crea los índices con sus mapeos si no existen."""
    try:
        es = get_client()
        for index in TODOS_LOS_INDICES:
            if not es.indices.exists(index=index):
                es.indices.create(index=index, mappings=MAPEOS[index])
        print("[elastic] índices listos")
    except Exception as e:
        print(f"[elastic] no se pudo inicializar (arranca igual): {e}")


def limpiar_antiguos():
    """
    Borra documentos más viejos que RETENCION_DIAS en todos los índices.
    Reemplazo simple de ILM: se invoca periódicamente desde el backend.
    """
    try:
        es = get_client()
        limite = (datetime.now(timezone.utc) - timedelta(days=RETENCION_DIAS)).isoformat()
        for index in TODOS_LOS_INDICES:
            if es.indices.exists(index=index):
                es.delete_by_query(
                    index=index,
                    query={"range": {"timestamp": {"lt": limite}}},
                    conflicts="proceed",
                )
        print(f"[elastic] limpieza de documentos > {RETENCION_DIAS} días completada")
    except Exception as e:
        print(f"[elastic] no se pudo ejecutar limpieza: {e}")
