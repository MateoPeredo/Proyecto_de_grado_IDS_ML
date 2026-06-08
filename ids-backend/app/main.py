"""
Punto de entrada del backend SigmaIDS.
"""
import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.mysql import init_db, SessionLocal
from app.db.clickhouse import init_clickhouse
from app.db.elastic import init_elastic
from app.models.user import User
from app.core.security import hash_password
from app.routers import auth, rules, alerts, monitor, ml, config as config_router, notifications


def seed_admin():
    """Crea el usuario admin/admin123 la primera vez (las credenciales demo del front)."""
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.username == "admin").first():
            db.add(User(
                username="admin",
                password_hash=hash_password("admin123"),
                role="admin",
            ))
            db.commit()
            print("[seed] usuario admin creado (admin / admin123)")
    except Exception as e:
        print(f"[seed] no se pudo crear admin: {e}")
    finally:
        db.close()


def seed_config():
    """Siembra la configuración por defecto del IDS si la tabla está vacía."""
    from app.models.config import Config, CONFIG_DEFAULTS
    db = SessionLocal()
    try:
        if db.query(Config).count() == 0:
            for clave, valor in CONFIG_DEFAULTS.items():
                db.add(Config(clave=clave, valor=valor))
            db.commit()
            print("[seed] configuración por defecto del IDS creada")
    except Exception as e:
        print(f"[seed] no se pudo crear la config: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # arranque: inicializa las tres bases (cada una tolera fallos por su cuenta)
    init_db()
    init_clickhouse()
    init_elastic()
    seed_admin()
    seed_config()
    yield
    # apagado: nada que limpiar por ahora


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

# CORS — el frontend va detrás del proxy de Nginx, pero esto cubre acceso directo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers (sin prefijo /api: Nginx ya quita ese prefijo al hacer proxy)
app.include_router(auth.router)
app.include_router(rules.router)
app.include_router(alerts.router)
app.include_router(monitor.router)
app.include_router(ml.router)
app.include_router(config_router.router)
app.include_router(notifications.router)


@app.get("/health")
def health():
    return {"status": "ok"}


# ── WebSocket en vivo ────────────────────────────────────────────────────────
# El frontend (ws.js) se conecta a /ws/live para recibir alertas en tiempo real.
@app.websocket("/ws/live")
async def ws_live(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            # Placeholder: aquí emitirás las alertas reales que detecte el IDS.
            # Por ahora mandamos un heartbeat cada 5s para validar la conexión.
            await ws.send_text(json.dumps({"type": "heartbeat", "ok": True}))
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass
