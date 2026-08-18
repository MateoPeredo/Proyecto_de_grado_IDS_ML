"""
Verificador ML — segunda etapa del IDS.

Carga el modelo activo (.pkl con la estructura de artefactos del notebook) y,
dado un conjunto de features de flujo, emite un veredicto:
  - es_ataque: True/False  (False = el ML cree que es BENIGN = falso positivo)
  - clase: la familia predicha (BENIGN, DoS, PortScan, ...)
  - confianza: probabilidad de la clase predicha (0..1), o None si no disponible

El modelo se carga UNA vez y se cachea. Si cambia el modelo activo (el usuario
elige otro .pkl), se llama recargar() para que tome el nuevo.

Estructura esperada del .pkl (igual que la que guardan los notebooks):
    {
        'modelo': <estimador sklearn/xgboost>,
        'imputer': <SimpleImputer>,
        'scaler': <StandardScaler>,
        'label_encoder': <LabelEncoder>,
        'columnas': [...15 nombres...],
        'usa_escalado': bool,
        'nombre_modelo': str,
    }
"""
import os
import threading


class VerificadorML:
    """Carga perezosa y cacheada del modelo activo, con verdicto por flujo."""

    def __init__(self, ruta_modelo: str):
        self.ruta_modelo = ruta_modelo
        self._artefactos = None
        self._mtime = None                # para detectar si el archivo cambió
        self._lock = threading.Lock()

    def disponible(self) -> bool:
        """¿Hay un archivo de modelo activo en disco?"""
        return bool(self.ruta_modelo) and os.path.exists(self.ruta_modelo)

    def _cargar_si_hace_falta(self):
        """Carga el .pkl si no está cargado o si cambió en disco."""
        if not self.disponible():
            self._artefactos = None
            return
        mtime = os.path.getmtime(self.ruta_modelo)
        if self._artefactos is not None and mtime == self._mtime:
            return  # ya está cargado y no cambió
        with self._lock:
            import joblib
            self._artefactos = joblib.load(self.ruta_modelo)
            # El verificador clasifica de a un flujo por vez (no en lote). Para
            # una única muestra, el paralelismo (n_jobs=-1) es contraproducente:
            # el costo de repartir los arboles entre varios nucleos supera al
            # calculo. Forzar n_jobs=1 acelera la prediccion individual varias
            # veces sin alterar el modelo ni sus resultados.
            try:
                modelo = self._artefactos.get("modelo")
                if modelo is not None and hasattr(modelo, "n_jobs"):
                    modelo.n_jobs = 1
            except Exception:
                pass
            self._mtime = mtime

    def recargar(self, nueva_ruta: str | None = None):
        """Fuerza recarga (por ejemplo, cuando el usuario cambia de modelo)."""
        if nueva_ruta is not None:
            self.ruta_modelo = nueva_ruta
        self._artefactos = None
        self._mtime = None
        self._cargar_si_hace_falta()

    def info(self) -> dict:
        """Metadatos del modelo activo (para el endpoint /ml)."""
        self._cargar_si_hace_falta()
        if self._artefactos is None:
            return {"cargado": False}
        # Clases que el modelo puede predecir (para la ficha técnica)
        clases = []
        le = self._artefactos.get("label_encoder")
        if le is not None:
            try:
                clases = list(le.classes_)
            except Exception:
                clases = []
        return {
            "cargado": True,
            "nombre_modelo": self._artefactos.get("nombre_modelo", "desconocido"),
            "columnas": self._artefactos.get("columnas", []),
            "n_features": len(self._artefactos.get("columnas", [])),
            "clases": clases,
            "n_clases": len(clases),
        }

    def verificar(self, features: dict) -> dict:
        """
        Dado un dict de features de flujo, devuelve el veredicto del modelo.
        Si no hay modelo cargado, devuelve disponible=False (el motor decide
        qué hacer en ese caso: por defecto, conservar la alerta de la firma).
        """
        self._cargar_si_hace_falta()
        if self._artefactos is None:
            return {"disponible": False}

        import numpy as np
        import pandas as pd

        art = self._artefactos
        cols = art["columnas"]

        # Construir el vector en el ORDEN exacto que espera el modelo
        fila = {c: features.get(c, 0) for c in cols}
        df = pd.DataFrame([fila], columns=cols)
        # Saneo defensivo: forzar cada columna a numérico. Cualquier valor no
        # convertible (texto corrupto, None, objetos) se transforma en NaN, que
        # el imputer luego reemplaza por la mediana. Así una entrada anómala
        # nunca interrumpe la clasificación (robustez ante tráfico corrupto).
        for c in cols:
            df[c] = pd.to_numeric(df[c], errors="coerce")
        df = df.replace([np.inf, -np.inf], np.nan)

        X = art["imputer"].transform(df)
        if art.get("usa_escalado"):
            X = art["scaler"].transform(X)

        modelo = art["modelo"]
        pred_cod = modelo.predict(X)
        clase = art["label_encoder"].inverse_transform(pred_cod)[0]

        confianza = None
        if hasattr(modelo, "predict_proba"):
            try:
                confianza = float(modelo.predict_proba(X).max(axis=1)[0])
            except Exception:
                confianza = None

        return {
            "disponible": True,
            "es_ataque": (str(clase) != "BENIGN"),
            "clase": str(clase),
            "confianza": confianza,
            "modelo": art.get("nombre_modelo", "desconocido"),
        }