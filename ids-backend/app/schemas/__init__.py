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
    segmento: str = "datos"
    ml_validado: bool = False
    ml_estado: str = "sin_ml"
    ml_confianza: Optional[int] = None
    ml_clase: Optional[str] = None
    acknowledged: bool

    model_config = {"from_attributes": True}


# ── Signatures (firmas del IDS) ───────────────────────────────────────────────
class SignatureCreate(BaseModel):
    nombre: str
    tipo_firma: str
    severidad: str = "medium"
    umbral: int = 20
    ventana_segundos: int = 10
    track_by: str = "src"
    puerto: Optional[int] = None
    protocolo: str = "tcp"
    enabled: bool = True
    descripcion: Optional[str] = None


class SignatureUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo_firma: Optional[str] = None
    severidad: Optional[str] = None
    umbral: Optional[int] = None
    ventana_segundos: Optional[int] = None
    track_by: Optional[str] = None
    puerto: Optional[int] = None
    protocolo: Optional[str] = None
    enabled: Optional[bool] = None
    descripcion: Optional[str] = None


class SignatureOut(BaseModel):
    id: int
    nombre: str
    tipo_firma: str
    severidad: str
    umbral: int
    ventana_segundos: int
    track_by: str
    puerto: Optional[int] = None
    protocolo: str
    enabled: bool
    descripcion: Optional[str] = None

    model_config = {"from_attributes": True}