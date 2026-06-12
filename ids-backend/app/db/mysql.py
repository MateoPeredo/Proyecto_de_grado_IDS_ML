"""
Conexión a MySQL vía SQLAlchemy.
Guarda los datos transaccionales: usuarios y reglas de firmas.
"""
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import OperationalError

from app.config import settings

engine = create_engine(
    settings.mysql_url,
    pool_pre_ping=True, 
    pool_recycle=3600,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency de FastAPI: entrega una sesión y la cierra al terminar."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(retries: int = 10, delay: int = 3):
    """
    Crea las tablas al arrancar. MySQL tarda unos segundos en aceptar conexiones,
    así que reintentamos varias veces antes de rendirnos.
    """

    from app.models import user, rule, config, alert, notification, ids_signature

    for intento in range(1, retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            print("[mysql] tablas listas")
            return
        except OperationalError as e:
            print(f"[mysql] intento {intento}/{retries} — MySQL no está listo aún: {e}")
            time.sleep(delay)
    print("[mysql] no se pudo conectar; el backend arranca igual (los endpoints darán error)")
