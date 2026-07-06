from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, func

from app.db.mysql import Base


class Alert(Base):
    """
    Alerta/alarma detectada por el IDS. Registro histórico para auditoría.
    Las genera el motor de detección (firmas o ML) cuando encuentra algo.
    """
    __tablename__ = "alerts"

    id             = Column(Integer, primary_key=True, index=True)
    timestamp      = Column(DateTime, server_default=func.now(), index=True)  # cuándo se detectó
    signature_name = Column(String(128), nullable=False)   # qué regla/firma la disparó
    severity       = Column(String(16), default="medium")  # low | medium | high | critical
    source_ip      = Column(String(45), nullable=True)     # 45 chars: cabe IPv6
    dest_ip        = Column(String(45), nullable=True)
    protocol       = Column(String(16), nullable=True)     # tcp | udp | icmp
    description    = Column(Text, nullable=True)
    detected_by    = Column(String(16), default="firma")   # firma | firma+ml (qué motor la detectó)
    segmento       = Column(String(32), default="datos")   # segmento/VLAN vigilado por el sensor
    ml_validado    = Column(Boolean, default=False)         # True solo si el ML CONFIRMÓ el ataque
    ml_estado      = Column(String(16), default="sin_ml")   # sin_ml | confirmado | no_concluyente
    ml_confianza   = Column(Integer, nullable=True)         # confianza del ML en %, 0-100 (None si no aplica)
    ml_clase       = Column(String(32), nullable=True)      # clase que predijo el ML (PortScan, DoS, BENIGN...)
    acknowledged   = Column(Boolean, default=False)        # si el analista ya la revisó
    created_at     = Column(DateTime, server_default=func.now())