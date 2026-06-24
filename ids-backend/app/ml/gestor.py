"""
Gestor de modelos ML.

Administra los archivos .pkl subidos por el usuario:
- Los guarda en una carpeta dedicada (MODELS_DIR).
- Lleva un registro (registro.json) de qué modelos hay y cuál está activo.
- Valida que un .pkl subido tenga la estructura de artefactos esperada.

El modelo "activo" es el que el motor usa como segunda etapa de verificación.
"""
import os
import json
import shutil
from datetime import datetime

# Carpeta donde viven los .pkl subidos. Configurable por entorno.
MODELS_DIR = os.environ.get("MODELS_DIR", "/app/app/ml/modelos")
REGISTRO = os.path.join(MODELS_DIR, "registro.json")

# Claves que debe tener un .pkl válido (estructura de artefactos del notebook)
CLAVES_REQUERIDAS = {"modelo", "imputer", "label_encoder", "columnas"}


def _asegurar_dir():
    os.makedirs(MODELS_DIR, exist_ok=True)


def _leer_registro() -> dict:
    _asegurar_dir()
    if not os.path.exists(REGISTRO):
        return {"activo": None, "modelos": []}
    try:
        with open(REGISTRO, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"activo": None, "modelos": []}


def _escribir_registro(data: dict):
    _asegurar_dir()
    with open(REGISTRO, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def validar_pkl(ruta: str) -> tuple[bool, str]:
    """
    Verifica que el archivo sea un .pkl con la estructura de artefactos correcta.
    Devuelve (es_valido, mensaje/nombre_modelo).
    """
    try:
        import joblib
        art = joblib.load(ruta)
    except Exception as e:
        return False, f"No se pudo leer el archivo como modelo: {e}"

    if not isinstance(art, dict):
        return False, "El .pkl no tiene la estructura esperada (debe ser un diccionario de artefactos)."

    faltan = CLAVES_REQUERIDAS - set(art.keys())
    if faltan:
        return False, f"Al .pkl le faltan claves requeridas: {', '.join(sorted(faltan))}"

    if not art.get("columnas"):
        return False, "El .pkl no incluye la lista de columnas (features)."

    nombre = art.get("nombre_modelo", "modelo")
    return True, nombre


def listar() -> dict:
    """Lista los modelos disponibles y cuál está activo."""
    reg = _leer_registro()
    # Filtrar los que ya no existen en disco
    existentes = []
    for m in reg["modelos"]:
        if os.path.exists(os.path.join(MODELS_DIR, m["archivo"])):
            existentes.append(m)
    reg["modelos"] = existentes
    if reg["activo"] and not any(m["archivo"] == reg["activo"] for m in existentes):
        reg["activo"] = None
    _escribir_registro(reg)
    return reg


def guardar(ruta_temp: str, nombre_archivo: str) -> dict:
    """
    Mueve un .pkl validado a la carpeta de modelos y lo registra.
    Si es el primer modelo, lo deja como activo automáticamente.
    Devuelve la entrada del registro creada.
    """
    _asegurar_dir()
    # Sanitizar nombre: solo el basename, sin rutas
    nombre_archivo = os.path.basename(nombre_archivo)
    if not nombre_archivo.endswith((".pkl", ".joblib")):
        nombre_archivo += ".pkl"

    destino = os.path.join(MODELS_DIR, nombre_archivo)
    # Evitar sobrescribir: si existe, añadir sufijo
    base, ext = os.path.splitext(nombre_archivo)
    i = 1
    while os.path.exists(destino):
        nombre_archivo = f"{base}_{i}{ext}"
        destino = os.path.join(MODELS_DIR, nombre_archivo)
        i += 1

    shutil.move(ruta_temp, destino)

    ok, info = validar_pkl(destino)
    nombre_modelo = info if ok else "desconocido"

    reg = _leer_registro()
    entrada = {
        "archivo": nombre_archivo,
        "nombre_modelo": nombre_modelo,
        "subido": datetime.now().isoformat(timespec="seconds"),
    }
    reg["modelos"].append(entrada)
    if reg["activo"] is None:        # primer modelo => activo por defecto
        reg["activo"] = nombre_archivo
    _escribir_registro(reg)
    return entrada


def activar(archivo: str) -> bool:
    """Marca un modelo como activo. Devuelve False si no existe."""
    reg = _leer_registro()
    if not any(m["archivo"] == archivo for m in reg["modelos"]):
        return False
    if not os.path.exists(os.path.join(MODELS_DIR, archivo)):
        return False
    reg["activo"] = archivo
    _escribir_registro(reg)
    return True


def eliminar(archivo: str) -> bool:
    """Elimina un modelo del registro y del disco."""
    reg = _leer_registro()
    antes = len(reg["modelos"])
    reg["modelos"] = [m for m in reg["modelos"] if m["archivo"] != archivo]
    if len(reg["modelos"]) == antes:
        return False
    ruta = os.path.join(MODELS_DIR, archivo)
    if os.path.exists(ruta):
        os.remove(ruta)
    if reg["activo"] == archivo:
        # Si borramos el activo, activar otro si queda alguno
        reg["activo"] = reg["modelos"][0]["archivo"] if reg["modelos"] else None
    _escribir_registro(reg)
    return True


def ruta_activo() -> str | None:
    """Ruta absoluta del .pkl activo, o None si no hay."""
    reg = _leer_registro()
    if not reg["activo"]:
        return None
    ruta = os.path.join(MODELS_DIR, reg["activo"])
    return ruta if os.path.exists(ruta) else None
