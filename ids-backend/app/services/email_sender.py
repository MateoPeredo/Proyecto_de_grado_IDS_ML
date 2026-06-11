"""
Servicio de envío de correos (SMTP).

Usa smtplib (incluido en Python) para enviar notificaciones por correo.
Soporta Gmail y Outlook/Live, y detecta automáticamente el método de cifrado
según el puerto:
  - Puerto 465 -> SSL directo (SMTP_SSL). Suele pasar firewalls/ISP.
  - Puerto 587 -> STARTTLS. Estándar, pero algunos ISP lo bloquean.

IMPORTANTE: la cuenta remitente necesita una "contraseña de aplicación"
(no la contraseña normal). Ver SMTP_USER y SMTP_PASSWORD en el .env.
"""
import smtplib
import ssl
from email.message import EmailMessage

from app.config import settings


class EmailError(Exception):
    """Error al enviar un correo (credenciales, conexión, etc.)."""
    pass


def enviar_correo(destinatario: str, asunto: str, cuerpo: str) -> None:
    """
    Envía un correo de texto plano al destinatario indicado.
    Elige SSL directo (465) o STARTTLS (587) según el puerto configurado.
    Lanza EmailError si algo falla.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise EmailError(
            "Faltan credenciales SMTP. Configurá SMTP_USER y SMTP_PASSWORD en el .env "
            "(la contraseña debe ser una 'contraseña de aplicación', no la normal)."
        )

    host, port = settings.smtp_server
    if not host:
        raise EmailError("No se pudo determinar el servidor SMTP. Revisá SMTP_PROVIDER.")

    # Construir el mensaje
    msg = EmailMessage()
    msg["Subject"] = asunto
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = destinatario
    msg.set_content(cuerpo)

    contexto = ssl.create_default_context()
    try:
        if int(port) == 465:
            # Puerto 465: conexión SSL directa desde el inicio
            with smtplib.SMTP_SSL(host, port, timeout=15, context=contexto) as servidor:
                servidor.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                servidor.send_message(msg)
        else:
            # Puerto 587 (u otros): STARTTLS sobre conexión en claro
            with smtplib.SMTP(host, port, timeout=15) as servidor:
                servidor.ehlo()
                servidor.starttls(context=contexto)
                servidor.ehlo()
                servidor.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                servidor.send_message(msg)
    except smtplib.SMTPAuthenticationError as e:
        raise EmailError(
            "Autenticación SMTP fallida. Verificá que SMTP_USER sea correcto y que "
            "SMTP_PASSWORD sea una contraseña de aplicación válida (con verificación "
            f"en dos pasos activada). Detalle: {e}"
        )
    except Exception as e:
        raise EmailError(f"No se pudo enviar el correo: {e}")


def enviar_alerta_email(destinatario: str, alerta: dict) -> None:
    """
    Envía una notificación de alerta con formato legible.
    `alerta` es un dict con los campos de la alerta (signature_name, severity, etc.).
    La usará la lógica de notificaciones cuando el motor genere alertas.
    """
    asunto = f"[IDS] Alerta {alerta.get('severity', '').upper()}: {alerta.get('signature_name', 'Detección')}"
    cuerpo = (
        "Se ha detectado una alerta en el sistema IDS.\n\n"
        f"Firma:         {alerta.get('signature_name', '-')}\n"
        f"Severidad:     {alerta.get('severity', '-')}\n"
        f"Tipo:          {alerta.get('tipo_ataque', '-')}\n"
        f"IP origen:     {alerta.get('source_ip', '-')}\n"
        f"IP destino:    {alerta.get('dest_ip', '-')}\n"
        f"Protocolo:     {alerta.get('protocol', '-')}\n"
        f"Detectado por: {alerta.get('detected_by', '-')}\n"
        f"Momento:       {alerta.get('timestamp', '-')}\n\n"
        f"Descripción:   {alerta.get('description', '-')}\n\n"
        "—\nEste es un mensaje automático del sistema IDS."
    )
    enviar_correo(destinatario, asunto, cuerpo)
