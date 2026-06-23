#!/usr/bin/env python3
"""
Script de prueba para enviar un correo desde la terminal.

Sirve para verificar que las credenciales SMTP del .env están bien configuradas
ANTES de conectar el envío a la lógica de alertas.

USO (desde la carpeta ids-backend):

    # Opción 1: dentro del contenedor del backend (recomendado, ya tiene el .env)
    sudo docker exec -it ids-backend python enviar_prueba.py destino@gmail.com

    # Opción 2: localmente, si tenés Python y el .env configurado
    python enviar_prueba.py destino@gmail.com

Si no pasás un destinatario, se envía a la misma cuenta remitente (SMTP_USER).
"""
import sys
import os

# Permite ejecutar el script estando en la carpeta ids-backend
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.services.email_sender import enviar_correo, EmailError


def main():
    # Destinatario: argumento de la terminal, o la propia cuenta remitente
    destinatario = sys.argv[1] if len(sys.argv) > 1 else settings.SMTP_USER

    if not destinatario:
        print("ERROR: no hay destinatario ni SMTP_USER configurado.")
        print("Uso: python enviar_prueba.py destino@correo.com")
        sys.exit(1)

    print("─" * 55)
    print("  Prueba de envío de correo del IDS")
    print("─" * 55)
    print(f"  Proveedor:    {settings.SMTP_PROVIDER}")
    print(f"  Servidor:     {settings.smtp_server[0]}:{settings.smtp_server[1]}")
    print(f"  Remitente:    {settings.SMTP_USER or '(no configurado)'}")
    print(f"  Destinatario: {destinatario}")
    print("─" * 55)

    try:
        enviar_correo(
            destinatario=destinatario,
            asunto="Prueba de notificación - IDS ML",
            cuerpo=(
                "¡Hola!\n\n"
                "Si estás leyendo esto, el servicio de correo del sistema IDS "
                "está configurado correctamente y puede enviar notificaciones.\n\n"
                "—\nMensaje de prueba automático."
            ),
        )
        print("\n  ✓ Correo enviado correctamente. Revisá la bandeja de entrada.")
        print("    (Si no aparece, mirá también la carpeta de spam.)\n")
    except EmailError as e:
        print(f"\n  ✗ No se pudo enviar el correo:\n    {e}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
