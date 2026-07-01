"""
Helper de auditoría: registra acciones de usuario en el log de plataforma.

La idea es tener UNA función simple, auditar(), que cada endpoint llama después
de hacer una acción importante (crear/editar/borrar). Así todas las acciones
quedan registradas en la sección de Logs de la plataforma, de forma uniforme.

Es tolerante a fallos: si Elasticsearch no está disponible, no rompe la acción.
"""


def auditar(usuario, evento: str, mensaje: str, nivel: str = "info"):
    """
    Registra una acción de usuario en el log de plataforma.

    - usuario: el objeto User (o None). Se usa su .username.
    - evento: etiqueta corta de la acción (ej: "notificacion_creada").
    - mensaje: descripción legible (ej: "Creó la notificación 'Alertas críticas'").
    - nivel: "info" | "warning" | "error".
    """
    try:
        from app.db.elastic import log_plataforma
        nombre = getattr(usuario, "username", None) if usuario else None
        log_plataforma(evento, mensaje, nivel=nivel, usuario=nombre)
    except Exception:
        # Nunca dejamos que un fallo de logging rompa la acción del usuario.
        pass
