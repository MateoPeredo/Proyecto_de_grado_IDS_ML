from sqlalchemy import Column, Integer, String, DateTime, func

from app.db.mysql import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(32), default="analyst")   # analyst | admin
    created_at    = Column(DateTime, server_default=func.now())
