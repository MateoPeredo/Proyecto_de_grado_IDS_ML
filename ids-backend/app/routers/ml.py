"""
Machine Learning: estado del modelo y gestión de modelos .pkl.

- GET  /ml/metrics          estado del modelo activo (compat con el frontend)
- GET  /ml/modelos          lista los .pkl disponibles y cuál está activo
- POST /ml/modelos          sube un nuevo .pkl (validado)
- POST /ml/modelos/activar  elige cuál usar
- DELETE /ml/modelos/{archivo}  elimina un modelo
- GET  /ml/export           descarga el modelo activo

La gestión de archivos vive en app.ml.gestor; la verificación en app.ml.verificador.
Solo el rol 'developer' puede gestionar modelos (según el RBAC del proyecto).
"""
import os
import tempfile

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse

from app.routers.auth import current_user
from app.core.permissions import require_roles
from app.ml import gestor

router = APIRouter(prefix="/ml", tags=["ml"])


@router.get("/metrics")
def get_metrics(_=Depends(require_roles("developer"))):
    """Estado del modelo activo. Mantiene las claves que el frontend ya usa."""
    ruta = gestor.ruta_activo()
    if not ruta:
        return {
            "model": "—",
            "trained": False,
            "accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0,
            "note": "No hay modelo activo. Subí un .pkl en esta página.",
        }
    ok, nombre = gestor.validar_pkl(ruta)
    return {
        "model": nombre if ok else "modelo",
        "trained": True,
        "accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0,
        "note": "Modelo activo cargado. Las métricas se evalúan en el notebook de entrenamiento.",
    }


@router.get("/modelos")
def listar_modelos(_=Depends(require_roles("developer"))):
    """Lista los modelos subidos y cuál está activo."""
    return gestor.listar()


@router.post("/modelos")
async def subir_modelo(
    archivo: UploadFile = File(...),
    _=Depends(require_roles("developer")),
):
    """Sube un .pkl, lo valida y lo registra. Si es el primero, queda activo."""
    sufijo = os.path.splitext(archivo.filename or "modelo.pkl")[1] or ".pkl"
    fd, tmp = tempfile.mkstemp(suffix=sufijo)
    try:
        with os.fdopen(fd, "wb") as f:
            contenido = await archivo.read()
            f.write(contenido)

        ok, info = gestor.validar_pkl(tmp)
        if not ok:
            os.remove(tmp)
            return JSONResponse(status_code=400, content={"detail": info})

        entrada = gestor.guardar(tmp, archivo.filename or "modelo.pkl")
        return {"ok": True, "modelo": entrada}
    except Exception as e:
        if os.path.exists(tmp):
            os.remove(tmp)
        return JSONResponse(status_code=500, content={"detail": f"Error al subir: {e}"})


@router.post("/modelos/activar")
def activar_modelo(payload: dict, _=Depends(require_roles("developer"))):
    """Elige cuál modelo usar como segunda etapa. Body: {"archivo": "..."}."""
    archivo = payload.get("archivo")
    if not archivo:
        return JSONResponse(status_code=400, content={"detail": "Falta 'archivo'."})
    if not gestor.activar(archivo):
        return JSONResponse(status_code=404, content={"detail": "Ese modelo no existe."})
    return {"ok": True, "activo": archivo}


@router.delete("/modelos/{archivo}")
def eliminar_modelo(archivo: str, _=Depends(require_roles("developer"))):
    """Elimina un modelo subido."""
    if not gestor.eliminar(archivo):
        return JSONResponse(status_code=404, content={"detail": "Ese modelo no existe."})
    return {"ok": True}


@router.get("/export")
def export_model(_=Depends(require_roles("developer"))):
    """Descarga el .pkl activo."""
    ruta = gestor.ruta_activo()
    if not ruta:
        return JSONResponse(status_code=404, content={"detail": "No hay modelo activo"})
    return FileResponse(
        ruta, media_type="application/octet-stream",
        filename=os.path.basename(ruta),
    )
