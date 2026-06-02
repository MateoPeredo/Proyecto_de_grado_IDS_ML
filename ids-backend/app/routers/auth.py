"""
Autenticación: /auth/login y /auth/logout.
Coincide con authService del frontend (api.js).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.mysql import get_db
from app.models.user import User
from app.core.security import verify_password, create_access_token, decode_token
from app.schemas import LoginRequest, TokenResponse

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
