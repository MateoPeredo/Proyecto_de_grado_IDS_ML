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
            _migrar_columnas_alerts()
            print("[mysql] tablas listas")
            return
        except OperationalError as e:
            print(f"[mysql] intento {intento}/{retries} — MySQL no está listo aún: {e}")
            time.sleep(delay)
    print("[mysql] no se pudo conectar; el backend arranca igual (los endpoints darán error)")


def _migrar_columnas_alerts():
    """
    Migración ligera: create_all NO agrega columnas nuevas a tablas que ya existen.
    Esta función agrega las columnas ml_validado y ml_confianza a 'alerts' si faltan,
    para no perder los datos existentes (sin necesidad de borrar la tabla).
    """
    from sqlalchemy import text
    nuevas = {
        "ml_validado": "ALTER TABLE alerts ADD COLUMN ml_validado TINYINT(1) DEFAULT 0",
        "ml_estado": "ALTER TABLE alerts ADD COLUMN ml_estado VARCHAR(16) DEFAULT 'sin_ml'",
        "ml_confianza": "ALTER TABLE alerts ADD COLUMN ml_confianza INT NULL",
    }
    try:
        with engine.connect() as conn:
            existentes = {row[0] for row in conn.execute(text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_NAME = 'alerts' AND TABLE_SCHEMA = DATABASE()"
            ))}
            for col, ddl in nuevas.items():
                if col not in existentes:
                    conn.execute(text(ddl))
                    conn.commit()
                    print(f"[mysql] columna '{col}' agregada a alerts")
    except Exception as e:
        print(f"[mysql] migración de columnas alerts omitida: {e}")