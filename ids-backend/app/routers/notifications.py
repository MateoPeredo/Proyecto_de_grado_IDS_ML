"""
Notificaciones: reglas de a quién avisar y bajo qué condiciones cuando se
genera una alerta. CRUD completo en MySQL.

IMPORTANTE: este router gestiona la CONFIGURACIÓN de notificaciones. El envío
real de correos (SMTP) es una etapa posterior; por ahora solo se guardan las reglas.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.mysql import get_db
from app.models.notification import Notification
from app.schemas import NotificationCreate, NotificationUpdate, NotificationOut
from app.routers.auth import current_user
from app.core.auditoria import auditar

router = APIRouter(prefix="/notifications", tags=["notifications"])

SEVERIDADES = ("low", "medium", "high", "critical")


@router.get("", response_model=list[NotificationOut])
def list_notifications(db: Session = Depends(get_db), _=Depends(current_user)):
    return db.query(Notification).order_by(Notification.id).all()


@router.post("", response_model=NotificationOut, status_code=201)
def create_notification(body: NotificationCreate, db: Session = Depends(get_db), usuario=Depends(current_user)):
    if body.severidad_minima not in SEVERIDADES:
        raise HTTPException(status_code=400, detail="Severidad inválida")
    notif = Notification(**body.model_dump())
    db.add(notif)
    db.commit()
    db.refresh(notif)
    auditar(usuario, "notificacion_creada", f"Creó la notificación '{notif.nombre}'")
    return notif


@router.put("/{notif_id}", response_model=NotificationOut)
def update_notification(notif_id: int, body: NotificationUpdate, db: Session = Depends(get_db), usuario=Depends(current_user)):
    notif = db.get(Notification, notif_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(notif, k, v)
    db.commit()
    db.refresh(notif)
    auditar(usuario, "notificacion_editada", f"Editó la notificación '{notif.nombre}'")
    return notif


@router.patch("/{notif_id}", response_model=NotificationOut)
def patch_notification(notif_id: int, body: NotificationUpdate, db: Session = Depends(get_db), usuario=Depends(current_user)):
    # mismo manejo que PUT, pensado para el toggle de enabled
    return update_notification(notif_id, body, db, usuario)


@router.delete("/{notif_id}")
def delete_notification(notif_id: int, db: Session = Depends(get_db), usuario=Depends(current_user)):
    notif = db.get(Notification, notif_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    nombre = notif.nombre
    db.delete(notif)
    db.commit()
    auditar(usuario, "notificacion_eliminada", f"Eliminó la notificación '{nombre}'", nivel="warning")
    return {"ok": True}
