"""
Control de acceso basado en roles (RBAC).

Roles del sistema (de mayor a menor privilegio):
  - developer : acceso total. Único que puede crear/editar/borrar firmas y ver el modelo ML.
  - admin     : puede ver y activar/desactivar firmas, gestionar usuarios; no crea/borra firmas.
  - analyst   : solo lectura.

Uso en un endpoint:
    @router.post("/algo")
    def crear(_=Depends(require_roles("developer"))):
        ...

La verificación ocurre en el BACKEND: aunque el frontend oculte un botón,
si el rol no tiene permiso, la API rechaza la operación (protección real).
"""
from fastapi import Depends, HTTPException

from app.models.user import User
from app.routers.auth import current_user

ROLES_VALIDOS = ("developer", "admin", "analyst")


def require_roles(*roles_permitidos: str):
    """Devuelve una dependencia que exige que el usuario tenga uno de los roles dados."""
    def verificar(user: User = Depends(current_user)) -> User:
        if user.role not in roles_permitidos:
            raise HTTPException(
                status_code=403,
                detail=f"Acción no permitida para el rol '{user.role}'.",
            )
        return user
    return verificar
