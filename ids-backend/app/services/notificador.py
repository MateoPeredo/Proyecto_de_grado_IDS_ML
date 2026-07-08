"""
Despachador de notificaciones por correo, con control anti-avalancha.

Cuando el motor guarda una alerta, llama a despachar_notificaciones(alerta).
Esta función:
  1. Busca las reglas de notificación ACTIVAS que coinciden con la alerta
     (por severidad mínima y tipo de ataque).
  2. Para cada regla que coincide, envía un correo al destinatario.
  3. ANTI-AVALANCHA: agrupa por tipo de firma. Si ya se envió un aviso para
     esa firma hace menos de VENTANA_MINUTOS, NO se reenvía. Esto evita que
     un ataque denso (PortScan, DoS) genere cientos de correos.

El registro de "último envío por firma" se mantiene en memoria. Es suficiente
porque el motor corre en un solo proceso (el sensor). Si el sensor se reinicia,
se vuelve a permitir el envío, lo cual es aceptable.

El envío se hace en un hilo aparte para no frenar la captura de paquetes
(enviar un correo puede tardar varios segundos).
"""
import time
import threading

from app.services.email_sender import enviar_alerta_email, EmailError

# Ventana anti-avalancha por defecto (minutos). Configurable vía entorno.
import os
VENTANA_MINUTOS = int(os.environ.get("NOTIF_VENTANA_MIN", "15"))

# Memoria de últimos envíos: { nombre_firma: timestamp_ultimo_envio }
_ultimo_envio: dict[str, float] = {}
_lock = threading.Lock()

# Orden de severidades para comparar "severidad mínima"
_NIVEL = {"low": 1, "medium": 2, "high": 3, "critical": 4}


def _coincide(regla, alerta: dict) -> bool:
    """¿La alerta cumple las condiciones de esta regla de notificación?
    Se filtra SOLO por tipo de ataque (la severidad ya no se usa: cualquier
    ataque que dispare una firma se considera relevante)."""
    # Tipo de ataque: "any" acepta todo; si no, debe coincidir con el de la alerta.
    if regla.tipo_ataque and regla.tipo_ataque != "any":
        tipo_alerta = str(alerta.get("tipo_ataque", "")).lower()
        if regla.tipo_ataque.lower() not in tipo_alerta:
            return False
    return True


def _puede_enviar(nombre_firma: str) -> bool:
    """
    Anti-avalancha: True solo si no se envió un aviso para esta firma
    dentro de la ventana. Si devuelve True, registra el envío.
    """
    ahora = time.time()
    limite = VENTANA_MINUTOS * 60
    with _lock:
        ultimo = _ultimo_envio.get(nombre_firma, 0)
        if ahora - ultimo < limite:
            return False                 # todavía en cooldown: no enviar
        _ultimo_envio[nombre_firma] = ahora
        return True


def _enviar_en_hilo(destinatarios: list[str], alerta: dict):
    """Envía los correos en segundo plano (no frena la captura)."""
    for dest in destinatarios:
        try:
            enviar_alerta_email(dest, alerta)
            print(f"[notif] aviso enviado a {dest} por '{alerta.get('signature_name')}'")
            # Registrar en Logs > Plataforma que se envió una notificación
            try:
                from app.db.elastic import log_plataforma
                ml = alerta.get("ml") or {}
                conf = ml.get("confianza") if ml.get("disponible") else None
                detalle_ml = f" (validado por ML {conf*100:.0f}%)" if conf is not None else ""
                log_plataforma(
                    "notificacion_enviada",
                    f"Se envió notificación a {dest} por la alerta "
                    f"'{alerta.get('signature_name')}' desde {alerta.get('source_ip')}{detalle_ml}",
                )
            except Exception:
                pass
        except EmailError as e:
            print(f"[notif] no se pudo enviar a {dest}: {e}")
            try:
                from app.db.elastic import log_plataforma
                log_plataforma(
                    "notificacion_fallida",
                    f"No se pudo enviar notificación a {dest}: {e}",
                    nivel="warning",
                )
            except Exception:
                pass
        except Exception as e:
            print(f"[notif] error inesperado enviando a {dest}: {e}")


def despachar_notificaciones(alerta: dict):
    """
    Punto de entrada: se llama después de guardar una alerta.
    Busca reglas activas que coincidan, aplica anti-avalancha y envía.
    Tolerante a fallos: nunca rompe el motor si algo sale mal.
    """
    try:
        from app.db.mysql import SessionLocal
        from app.models.notification import Notification

        nombre_firma = str(alerta.get("signature_name", "?"))

        # Anti-avalancha PRIMERO: si esta firma está en cooldown, ni consultamos la BD.
        if not _puede_enviar(nombre_firma):
            return

        db = SessionLocal()
        try:
            reglas = db.query(Notification).filter(Notification.enabled == True).all()
        finally:
            db.close()

        # Filtrar las reglas que coinciden y juntar destinatarios
        destinatarios = [r.email for r in reglas if _coincide(r, alerta)]
        if not destinatarios:
            # Nadie a quien avisar: liberamos el registro para no "gastar" la ventana
            with _lock:
                _ultimo_envio.pop(nombre_firma, None)
            return

        # Enviar en hilo aparte (el envío SMTP puede tardar)
        hilo = threading.Thread(
            target=_enviar_en_hilo, args=(destinatarios, alerta), daemon=True
        )
        hilo.start()
    except Exception as e:
        print(f"[notif] despachador falló (ignorado para no frenar el motor): {e}")
