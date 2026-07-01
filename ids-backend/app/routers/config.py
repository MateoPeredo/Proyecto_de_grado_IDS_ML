"""
Configuración del IDS: leer y guardar los parámetros (captura de red,
motor de detección por firmas). Se guarda en MySQL como pares clave-valor.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.mysql import get_db
from app.models.config import Config, CONFIG_DEFAULTS
from app.routers.auth import current_user
from app.core.auditoria import auditar

router = APIRouter(prefix="/config", tags=["config"])


@router.get("")
def get_config(db: Session = Depends(get_db), _=Depends(current_user)):
    """Devuelve toda la configuración como un diccionario clave: valor."""
    filas = db.query(Config).all()
    cfg = {f.clave: f.valor for f in filas}
    # completar con defaults las claves que aún no estén en la BD
    for k, v in CONFIG_DEFAULTS.items():
        cfg.setdefault(k, v)
    return cfg


@router.put("")
def update_config(nuevos: dict, db: Session = Depends(get_db), usuario=Depends(current_user)):
    """
    Guarda/actualiza los parámetros recibidos. Solo acepta claves conocidas
    (las definidas en CONFIG_DEFAULTS) para evitar basura en la tabla.
    """
    guardados = {}
    for clave, valor in nuevos.items():
        if clave not in CONFIG_DEFAULTS:
            continue  # ignora claves desconocidas
        fila = db.query(Config).filter(Config.clave == clave).first()
        if fila:
            fila.valor = str(valor)
        else:
            fila = Config(clave=clave, valor=str(valor))
            db.add(fila)
        guardados[clave] = str(valor)
    db.commit()
    auditar(usuario, "config_actualizada", f"Actualizó la configuración del IDS: {', '.join(guardados.keys())}")
    return {"ok": True, "guardados": guardados}
