"""
CRUD de reglas de firmas. Coincide con rulesService del frontend.
Datos en MySQL.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.mysql import get_db
from app.models.rule import Rule
from app.schemas import RuleCreate, RuleUpdate, RuleOut
from app.routers.auth import current_user
from app.core.auditoria import auditar

router = APIRouter(prefix="/rules", tags=["rules"])


@router.get("", response_model=list[RuleOut])
def list_rules(db: Session = Depends(get_db), _=Depends(current_user)):
    return db.query(Rule).order_by(Rule.id).all()


@router.post("", response_model=RuleOut)
def create_rule(body: RuleCreate, db: Session = Depends(get_db), usuario=Depends(current_user)):
    rule = Rule(**body.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    auditar(usuario, "regla_creada", f"Creó la regla '{getattr(rule, 'nombre', rule.id)}'")
    return rule


@router.put("/{rule_id}", response_model=RuleOut)
def update_rule(rule_id: int, body: RuleUpdate, db: Session = Depends(get_db), usuario=Depends(current_user)):
    rule = db.get(Rule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    auditar(usuario, "regla_editada", f"Editó la regla '{getattr(rule, 'nombre', rule.id)}'")
    return rule


@router.patch("/{rule_id}", response_model=RuleOut)
def patch_rule(rule_id: int, body: RuleUpdate, db: Session = Depends(get_db), usuario=Depends(current_user)):
    # mismo manejo que PUT pero pensado para toggles (enabled)
    return update_rule(rule_id, body, db, usuario)


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db), usuario=Depends(current_user)):
    rule = db.get(Rule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    nombre = getattr(rule, 'nombre', rule.id)
    db.delete(rule)
    db.commit()
    auditar(usuario, "regla_eliminada", f"Eliminó la regla '{nombre}'", nivel="warning")
    return {"ok": True}
