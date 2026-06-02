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
