"""
Firmas del IDS: CRUD completo sobre la tabla ids_signatures.
Estas son las firmas conductuales que el motor de captura usa para detectar
ataques. Se pueden ver, crear, editar, activar/desactivar y borrar.

El motor recarga las firmas activas periódicamente, así que los cambios hechos
acá se reflejan en la detección sin reiniciar el sensor.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.mysql import get_db
from app.models.ids_signature import IDSSignature, TIPOS_FIRMA
from app.schemas import SignatureCreate, SignatureUpdate, SignatureOut
from app.routers.auth import current_user

router = APIRouter(prefix="/signatures", tags=["signatures"])

SEVERIDADES = ("low", "medium", "high", "critical")
TRACK_BY = ("src", "dst")
PROTOCOLOS = ("tcp", "udp", "icmp", "any")


def _validar(tipo_firma, severidad, track_by, protocolo):
    """Valida los campos enumerados; lanza 400 si alguno es inválido."""
    if tipo_firma not in TIPOS_FIRMA:
        raise HTTPException(status_code=400, detail=f"Tipo de firma inválido. Válidos: {', '.join(TIPOS_FIRMA)}")
    if severidad not in SEVERIDADES:
        raise HTTPException(status_code=400, detail="Severidad inválida")
    if track_by not in TRACK_BY:
        raise HTTPException(status_code=400, detail="track_by debe ser 'src' o 'dst'")
    if protocolo not in PROTOCOLOS:
        raise HTTPException(status_code=400, detail="Protocolo inválido")


@router.get("", response_model=list[SignatureOut])
def list_signatures(db: Session = Depends(get_db), _=Depends(current_user)):
    return db.query(IDSSignature).order_by(IDSSignature.id).all()


@router.post("", response_model=SignatureOut, status_code=201)
def create_signature(body: SignatureCreate, db: Session = Depends(get_db), _=Depends(current_user)):
    _validar(body.tipo_firma, body.severidad, body.track_by, body.protocolo)
    if body.umbral < 1:
        raise HTTPException(status_code=400, detail="El umbral debe ser al menos 1")
    if body.ventana_segundos < 1:
        raise HTTPException(status_code=400, detail="La ventana debe ser al menos 1 segundo")
    firma = IDSSignature(**body.model_dump())
    db.add(firma)
    db.commit()
    db.refresh(firma)
    from app.db.elastic import log_plataforma
    log_plataforma("firma_creada", f"Se creó la firma '{firma.nombre}' (tipo {firma.tipo_firma})")
    return firma


@router.put("/{firma_id}", response_model=SignatureOut)
def update_signature(firma_id: int, body: SignatureUpdate, db: Session = Depends(get_db), _=Depends(current_user)):
    firma = db.get(IDSSignature, firma_id)
    if not firma:
        raise HTTPException(status_code=404, detail="Firma no encontrada")
    datos = body.model_dump(exclude_unset=True)
    # Validar solo los campos enumerados que vengan en la edición
    if "tipo_firma" in datos and datos["tipo_firma"] not in TIPOS_FIRMA:
        raise HTTPException(status_code=400, detail="Tipo de firma inválido")
    if "severidad" in datos and datos["severidad"] not in SEVERIDADES:
        raise HTTPException(status_code=400, detail="Severidad inválida")
    if "track_by" in datos and datos["track_by"] not in TRACK_BY:
        raise HTTPException(status_code=400, detail="track_by inválido")
    if "protocolo" in datos and datos["protocolo"] not in PROTOCOLOS:
        raise HTTPException(status_code=400, detail="Protocolo inválido")
    for k, v in datos.items():
        setattr(firma, k, v)
    db.commit()
    db.refresh(firma)
    return firma


@router.patch("/{firma_id}", response_model=SignatureOut)
def patch_signature(firma_id: int, body: SignatureUpdate, db: Session = Depends(get_db), _=Depends(current_user)):
    # mismo manejo que PUT, pensado para el toggle de enabled
    return update_signature(firma_id, body, db, _)


@router.delete("/{firma_id}")
def delete_signature(firma_id: int, db: Session = Depends(get_db), _=Depends(current_user)):
    firma = db.get(IDSSignature, firma_id)
    if not firma:
        raise HTTPException(status_code=404, detail="Firma no encontrada")
    db.delete(firma)
    db.commit()
    return {"ok": True}
