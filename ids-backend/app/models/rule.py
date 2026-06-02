from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, func

from app.db.mysql import Base


class Rule(Base):
    """Regla de firma del IDS (estilo Snort/Suricata simplificado)."""
    __tablename__ = "rules"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(128), nullable=False)
    pattern     = Column(Text, nullable=False)        # la firma / patrón a buscar
    severity    = Column(String(16), default="medium")  # low | medium | high | critical
    protocol    = Column(String(16), default="any")     # tcp | udp | icmp | any
    enabled     = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())
