from pydantic import BaseModel
from typing import Optional


# ── Auth ─────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


# ── Usuarios ─────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "analyst"   # analyst | admin


class UserUpdate(BaseModel):
    password: Optional[str] = None   # opcional: solo si se quiere cambiar
    role: Optional[str] = None        # opcional: analyst | admin


class UserOut(BaseModel):
    id: int
    username: str
    role: str

    model_config = {"from_attributes": True}


# ── Rules ────────────────────────────────────────────────────────────────────
class RuleCreate(BaseModel):
    name: str
    pattern: str
    severity: str = "medium"
    protocol: str = "any"
    enabled: bool = True
    description: Optional[str] = None


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    pattern: Optional[str] = None
    severity: Optional[str] = None
    protocol: Optional[str] = None
    enabled: Optional[bool] = None
    description: Optional[str] = None


class RuleOut(BaseModel):
    id: int
    name: str
    pattern: str
    severity: str
    protocol: str
    enabled: bool
    description: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Notifications ────────────────────────────────────────────────────────────
class NotificationCreate(BaseModel):
    nombre: str
    email: str
    severidad_minima: str = "high"
    tipo_ataque: str = "any"
    enabled: bool = True


class NotificationUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[str] = None
    severidad_minima: Optional[str] = None
    tipo_ataque: Optional[str] = None
    enabled: Optional[bool] = None


class NotificationOut(BaseModel):
    id: int
    nombre: str
    email: str
    severidad_minima: str
    tipo_ataque: str
    enabled: bool

    model_config = {"from_attributes": True}


# ── Alerts ───────────────────────────────────────────────────────────────────
class AlertOut(BaseModel):
    id: int
    timestamp: Optional[object] = None
    signature_name: str
    severity: str
    source_ip: Optional[str] = None
    dest_ip: Optional[str] = None
    protocol: Optional[str] = None
    description: Optional[str] = None
    detected_by: str
    acknowledged: bool

    model_config = {"from_attributes": True}
