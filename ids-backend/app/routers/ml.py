"""
Machine Learning: coincide con mlService del frontend.
Métricas del modelo Random Forest del IDS.

Por ahora devuelve métricas de ejemplo si no hay modelo entrenado todavía.
Cuando entrenes y guardes el modelo en MODEL_PATH, este endpoint leerá las
métricas reales que guardes junto a él.
"""
import os

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings
from app.routers.auth import current_user

router = APIRouter(prefix="/ml", tags=["ml"])


@router.get("/metrics")
def get_metrics(_=Depends(current_user)):
    # Si más adelante guardas un JSON de métricas junto al modelo, lo lees acá.
    return {
        "model": "RandomForestClassifier",
        "trained": os.path.exists(settings.MODEL_PATH),
        "accuracy": 0.0,
        "precision": 0.0,
        "recall": 0.0,
        "f1": 0.0,
        "note": "Aún no hay modelo entrenado. Entrena y guarda en MODEL_PATH.",
    }


@router.post("/retrain")
def retrain(_=Depends(current_user)):
    # Aquí irá el pipeline real: cargar dataset → entrenar RandomForest → joblib.dump
    return {"ok": True, "status": "entrenamiento encolado (placeholder)"}


@router.get("/export")
def export_model(_=Depends(current_user)):
    if not os.path.exists(settings.MODEL_PATH):
        return JSONResponse(status_code=404, content={"detail": "No hay modelo para exportar"})
    return FileResponse(
        settings.MODEL_PATH,
        media_type="application/octet-stream",
        filename="ids_model.joblib",
    )
