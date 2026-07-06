"""
Machine Learning: estado del modelo, estadísticas y gestión de modelos .pkl.

Lectura (los tres roles: developer, admin, analyst):
- GET  /ml/metrics          estado + ficha técnica del modelo activo
- GET  /ml/modelos          lista los .pkl disponibles y cuál está activo
- GET  /ml/stats            estadísticas de funcionamiento (resumen de las 2 etapas)

Escritura (solo developer):
- POST   /ml/modelos          sube un nuevo .pkl (validado)
- POST   /ml/modelos/activar  elige cuál usar
- DELETE /ml/modelos/{archivo}  elimina un modelo
- GET    /ml/export           descarga el modelo activo

Los roles admin/analyst pueden VER el estado y las estadísticas del modelo,
pero NO pueden subir, activar ni eliminar modelos. La verificación es real en
el backend: aunque el frontend oculte los botones, la API rechaza la operación.
"""
import os
import tempfile

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import func

from app.routers.auth import current_user
from app.core.permissions import require_roles
from app.ml import gestor
from app.ml.verificador import VerificadorML
from app.core.auditoria import auditar
from app.db.mysql import SessionLocal
from app.models.alert import Alert

router = APIRouter(prefix="/ml", tags=["ml"])

# Los tres roles pueden leer; solo developer puede escribir.
LECTURA = require_roles("developer", "admin", "analyst")
ESCRITURA = require_roles("developer")


@router.get("/metrics")
def get_metrics(_=Depends(LECTURA)):
    """Estado + ficha técnica del modelo activo. Visible para los 3 roles."""
    ruta = gestor.ruta_activo()
    if not ruta:
        return {
            "model": "—",
            "trained": False,
            "note": "No hay modelo activo.",
            "clases": [], "n_features": 0,
        }
    # Ficha técnica desde el verificador (nombre, clases, features)
    info = VerificadorML(ruta).info()
    # Fecha de subida desde el registro
    reg = gestor.listar()
    activo = reg.get("activo")
    entrada = next((m for m in reg.get("modelos", []) if m["archivo"] == activo), {})
    return {
        "model": info.get("nombre_modelo", "modelo"),
        "trained": True,
        "clases": info.get("clases", []),
        "n_clases": info.get("n_clases", 0),
        "n_features": info.get("n_features", 0),
        "columnas": info.get("columnas", []),
        "archivo": activo,
        "subido": entrada.get("subido"),
        "note": "Modelo activo cargado. Las métricas de test se evalúan en el notebook de entrenamiento.",
    }


@router.get("/modelos")
def listar_modelos(_=Depends(LECTURA)):
    """Lista los modelos subidos y cuál está activo. Visible para los 3 roles."""
    return gestor.listar()


@router.get("/stats")
def stats(_=Depends(LECTURA)):
    """
    Estadísticas de funcionamiento del sistema de dos etapas, calculadas sobre
    las alertas guardadas. Visible para los 3 roles (admin/analyst monitorean).

    Devuelve:
      - total de alertas
      - resumen de las dos etapas: confirmadas por ML / detectadas por firma /
        sin verificación ML
      - descartadas por el ML (falsos positivos filtrados)  [si se registran]
      - alertas por clase de ataque (según lo que predijo el ML)
    """
    db = SessionLocal()
    try:
        total = db.query(func.count(Alert.id)).scalar() or 0

        # Resumen de las dos etapas (por ml_estado)
        por_estado = dict(
            db.query(Alert.ml_estado, func.count(Alert.id))
              .group_by(Alert.ml_estado).all()
        )
        confirmadas = int(por_estado.get("confirmado", 0))
        solo_firma  = int(por_estado.get("no_concluyente", 0))
        sin_ml      = int(por_estado.get("sin_ml", 0))

        # Alertas por clase que predijo el ML (solo las confirmadas tienen clase)
        por_clase = dict(
            db.query(Alert.ml_clase, func.count(Alert.id))
              .filter(Alert.ml_clase.isnot(None))
              .group_by(Alert.ml_clase).all()
        )
        por_clase = {k: int(v) for k, v in por_clase.items() if k}

        # Alertas por severidad
        por_severidad = dict(
            db.query(Alert.severity, func.count(Alert.id))
              .group_by(Alert.severity).all()
        )
        por_severidad = {k: int(v) for k, v in por_severidad.items()}

        return {
            "total": int(total),
            "dos_etapas": {
                "confirmadas_ml": confirmadas,   # ML confirmó el ataque
                "solo_firma": solo_firma,        # firma detectó, ML no concluyente
                "sin_ml": sin_ml,                # sin verificación ML
            },
            "por_clase": por_clase,
            "por_severidad": por_severidad,
        }
    finally:
        db.close()


@router.post("/modelos")
async def subir_modelo(
    archivo: UploadFile = File(...),
    usuario=Depends(ESCRITURA),
):
    """Sube un .pkl, lo valida y lo registra. Solo developer."""
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
        auditar(usuario, "modelo_subido", f"Subió el modelo '{entrada.get('nombre_modelo', archivo.filename)}'")
        return {"ok": True, "modelo": entrada}
    except Exception as e:
        if os.path.exists(tmp):
            os.remove(tmp)
        return JSONResponse(status_code=500, content={"detail": f"Error al subir: {e}"})


@router.post("/modelos/activar")
def activar_modelo(payload: dict, usuario=Depends(ESCRITURA)):
    """Elige cuál modelo usar como segunda etapa. Solo developer. Body: {"archivo": "..."}."""
    archivo = payload.get("archivo")
    if not archivo:
        return JSONResponse(status_code=400, content={"detail": "Falta 'archivo'."})
    if not gestor.activar(archivo):
        return JSONResponse(status_code=404, content={"detail": "Ese modelo no existe."})
    auditar(usuario, "modelo_activado", f"Activó el modelo '{archivo}' como segunda etapa")
    return {"ok": True, "activo": archivo}


@router.delete("/modelos/{archivo}")
def eliminar_modelo(archivo: str, usuario=Depends(ESCRITURA)):
    """Elimina un modelo subido. Solo developer."""
    if not gestor.eliminar(archivo):
        return JSONResponse(status_code=404, content={"detail": "Ese modelo no existe."})
    auditar(usuario, "modelo_eliminado", f"Eliminó el modelo '{archivo}'", nivel="warning")
    return {"ok": True}


@router.get("/export")
def export_model(_=Depends(ESCRITURA)):
    """Descarga el .pkl activo. Solo developer."""
    ruta = gestor.ruta_activo()
    if not ruta:
        return JSONResponse(status_code=404, content={"detail": "No hay modelo activo"})
    return FileResponse(
        ruta, media_type="application/octet-stream",
        filename=os.path.basename(ruta),
    )
