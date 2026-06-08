"""
Alertas: registro histórico de detecciones del IDS. Guardadas en MySQL.
Coincide con alertsService del frontend.

Arranca vacía: las alertas reales las generará el motor de detección del IDS
más adelante. Por ahora la tabla queda lista para recibirlas y auditarlas.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.mysql import get_db
from app.models.alert import Alert
from app.schemas import AlertOut
from app.routers.auth import current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def get_alerts(
    limit: int = Query(100, le=1000),
    severity: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(current_user),
):
    q = db.query(Alert)
    if severity:
        q = q.filter(Alert.severity == severity)
    return q.order_by(Alert.timestamp.desc()).limit(limit).all()


@router.patch("/{alert_id}/ack")
def acknowledge(alert_id: int, db: Session = Depends(get_db), _=Depends(current_user)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    alert.acknowledged = True
    db.commit()
    return {"ok": True, "id": alert_id}


@router.post("/ack-all")
def acknowledge_all(db: Session = Depends(get_db), _=Depends(current_user)):
    db.query(Alert).filter(Alert.acknowledged == False).update({"acknowledged": True})
    db.commit()
    return {"ok": True}
