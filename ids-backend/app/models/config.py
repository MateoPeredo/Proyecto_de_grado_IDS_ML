from sqlalchemy import Column, Integer, String, DateTime, func

from app.db.mysql import Base


class Config(Base):
    """
    Configuración del IDS guardada como pares clave-valor.
    Un esquema clave-valor es flexible: permite agregar nuevos ajustes sin
    cambiar la estructura de la tabla. Cada fila es un parámetro de configuración.
    """
    __tablename__ = "config"

    id         = Column(Integer, primary_key=True, index=True)
    clave      = Column(String(64), unique=True, nullable=False, index=True)
    valor      = Column(String(255), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# Valores por defecto de la configuración del IDS.
# Se siembran al arrancar si la tabla está vacía.
CONFIG_DEFAULTS = {
    # Motor de detección (firmas) — parámetros globales, comunes a todos los sensores.
    "deteccion_accion": "alertar_registrar",  # solo_alertar | alertar_registrar
    "deteccion_log_level": "info",            # debug | info | warning | error
}
