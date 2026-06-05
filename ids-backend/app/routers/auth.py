"""
Autenticación: /auth/login y /auth/logout.
Coincide con authService del frontend (api.js).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.mysql import get_db
from app.models.user import User
from app.core.security import verify_password, create_access_token, decode_token, hash_password
from app.schemas import LoginRequest, TokenResponse, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token = create_access_token({"sub": user.username, "role": user.role})
    return TokenResponse(access_token=token, username=user.username, role=user.role)


@router.post("/logout")
def logout():
    # Con JWT sin estado, el logout real lo hace el cliente borrando el token.
    return {"ok": True}


# ── Dependency reutilizable para proteger endpoints ──────────────────────────
def current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status_code=401, detail="Falta el token")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    user = db.query(User).filter(User.username == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


# ── Datos del usuario autenticado ────────────────────────────────────────────
@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


# ── Registro / gestión de usuarios ───────────────────────────────────────────
@router.post("/register", response_model=UserOut, status_code=201)
def register(body: UserCreate, db: Session = Depends(get_db), _: User = Depends(current_user)):
    """
    Crea un nuevo usuario. Requiere estar autenticado (solo un usuario logueado
    puede dar de alta a otros). El primer usuario 'admin' lo crea el backend al arrancar.
    """
    existe = db.query(User).filter(User.username == body.username).first()
    if existe:
        raise HTTPException(status_code=409, detail="El nombre de usuario ya existe")
    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 4 caracteres")

    nuevo = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role if body.role in ("analyst", "admin") else "analyst",
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return db.query(User).order_by(User.id).all()
