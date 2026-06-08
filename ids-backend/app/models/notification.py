from sqlalchemy import Column, Integer, String, Boolean, DateTime, func

from app.db.mysql import Base


class Notification(Base):
    """
    Regla de notificación: define a qué correo avisar y bajo qué condiciones
    cuando se genera una alerta. NO envía el mail (eso es una etapa posterior);
    solo guarda la configuración de cuándo y a quién notificar.
    """
    __tablename__ = "notifications"

    id               = Column(Integer, primary_key=True, index=True)
    nombre           = Column(String(128), nullable=False)   # nombre descriptivo de la regla
    email            = Column(String(255), nullable=False)   # destino del aviso
    severidad_minima = Column(String(16), default="high")    # low | medium | high | critical
    tipo_ataque      = Column(String(32), default="any")     # any | DoS | DDoS | PortScan | BruteForce | WebAttack | Bot
    enabled          = Column(Boolean, default=True)         # activar/desactivar sin borrar
    created_at       = Column(DateTime, server_default=func.now())
    updated_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())
