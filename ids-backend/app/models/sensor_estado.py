from sqlalchemy import Column, Integer, String, DateTime, func

from app.db.mysql import Base


class SensorEstado(Base):
    """
    Estado (latido) de cada sensor por segmento.

    Como el front NO controla Docker, la forma de saber si un sensor está vivo es
    que cada sensor actualice su 'ultimo_latido' cada pocos segundos. Si el latido
    es reciente -> activo; si quedó viejo -> inactivo. Solo lectura desde el front.
    """
    __tablename__ = "sensor_estado"

    segmento       = Column(String(32), primary_key=True)   # datos | contable | ...
    interfaz       = Column(String(32), nullable=True)       # br-datos, br-wifi, ...
    ultimo_latido  = Column(DateTime, server_default=func.now())
