"""
Latido (heartbeat) del sensor.

Cada sensor llama a `latir(segmento, interfaz)` periódicamente para dejar
constancia en MySQL de que está vivo. El front lee esa tabla para mostrar el
estado (activo/inactivo) de cada segmento, sin necesidad de acceder a Docker.
"""
from datetime import datetime

from app.db.mysql import SessionLocal
from app.models.sensor_estado import SensorEstado


def latir(segmento: str, interfaz: str = "") -> None:
    """Registra/actualiza el latido de este sensor. Nunca rompe el motor."""
    db = SessionLocal()
    try:
        fila = db.get(SensorEstado, segmento)
        if fila is None:
            fila = SensorEstado(segmento=segmento, interfaz=interfaz,
                                ultimo_latido=datetime.now())
            db.add(fila)
        else:
            fila.interfaz = interfaz
            fila.ultimo_latido = datetime.now()
        db.commit()
    except Exception as e:
        print(f"[sensor] no se pudo registrar el latido: {e}")
    finally:
        db.close()
