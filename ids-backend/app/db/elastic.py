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


# ──────────────────────────────────────────────────────────────────────────────
#  Funciones de ESCRITURA de logs (ASÍNCRONAS).
#
#  Las funciones log_* NO escriben directo a Elasticsearch: encolan el documento
#  (operación instantánea) y un hilo de fondo vacía la cola en lotes (bulk).
#  Así la captura del sensor NUNCA se frena esperando a Elasticsearch, aunque
#  esté lento. Si la cola se llena, se descartan logs (preferimos no frenar).
#  El timestamp se genera con hora local (según TZ del contenedor).
# ──────────────────────────────────────────────────────────────────────────────
import queue
import threading
import time as _time

# Cola de documentos pendientes de escribir. maxsize evita consumir RAM sin límite.
_cola_logs: "queue.Queue" = queue.Queue(maxsize=10000)
_escritor_iniciado = False
_escritor_lock = threading.Lock()


def _iniciar_escritor():
    """Arranca (una sola vez) el hilo que vacía la cola hacia Elasticsearch."""
    global _escritor_iniciado
    with _escritor_lock:
        if _escritor_iniciado:
            return
        _escritor_iniciado = True
        hilo = threading.Thread(target=_bucle_escritor, daemon=True)
        hilo.start()


def _bucle_escritor():
    """
    Hilo de fondo: agrupa documentos de la cola y los escribe en lotes (bulk),
    que es mucho más eficiente que uno por uno. Vacía cada ~1 segundo.
    """
    from elasticsearch.helpers import bulk
    while True:
        lote = []
        try:
            # Espera bloqueante por el primer documento (no consume CPU en vacío)
            primero = _cola_logs.get()
            lote.append(primero)
            # Junta todo lo que haya disponible sin bloquear (hasta 500)
            while len(lote) < 500:
                try:
                    lote.append(_cola_logs.get_nowait())
                except queue.Empty:
                    break
        except Exception:
            _time.sleep(1)
            continue

        # Escribir el lote a Elasticsearch
        try:
            es = get_client()
            acciones = [{"_index": idx, "_source": doc} for (idx, doc) in lote]
            bulk(es, acciones, raise_on_error=False, request_timeout=10)
        except Exception:
            # Si falla, descartamos el lote (no reintentar para no acumular)
            pass


def _indexar(index: str, doc: dict):
    """Encola un documento para escritura asíncrona. Nunca bloquea ni falla."""
    _iniciar_escritor()
    try:
        _cola_logs.put_nowait((index, doc))
    except queue.Full:
        # Cola llena (Elastic muy lento): descartamos el log para no frenar nada
        pass


def log_plataforma(evento: str, mensaje: str, nivel: str = "info", usuario: str | None = None):
    """Registra un evento operativo del sistema (login, creación de reglas, etc.)."""
    _indexar(INDEX_LOG_PLATAFORMA, {
        "timestamp": datetime.now().isoformat(),
        "nivel": nivel,
        "evento": evento,
        "usuario": usuario,
        "mensaje": mensaje,
    })


def log_deteccion(motor: str, resultado: str, detalle: str = "", confianza: float | None = None):
    """Registra una decisión del motor de detección (firma o ML)."""
    doc = {
        "timestamp": datetime.now().isoformat(),
        "motor": motor,          # firma | ml
        "resultado": resultado,  # benigno | malicioso
        "detalle": detalle,
    }
    if confianza is not None:
        doc["confianza"] = confianza
    _indexar(INDEX_LOG_DETECCION, doc)


def log_trafico(ip_origen, ip_destino, protocolo, clasificacion,
                puerto_origen=None, puerto_destino=None, bytes_=0, paquetes=1):
    """Registra un flujo de tráfico capturado (para búsqueda por IP/protocolo)."""
    _indexar(INDEX_TRAFICO, {
        "timestamp": datetime.now().isoformat(),
        "ip_origen": ip_origen,
        "ip_destino": ip_destino,
        "puerto_origen": puerto_origen,
        "puerto_destino": puerto_destino,
        "protocolo": protocolo,
        "bytes": bytes_,
        "paquetes": paquetes,
        "clasificacion": clasificacion,  # normal | malicioso
    })
