"""Estábulo e Centro de Treinamento."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..game import training
from ..game.progression import ATTR_TRAIN_COST
from ..game.registry import CHAR_INFO, char_bio, item_public
from ..game.rewards import describe, get_qty
from ..game.serializers import uc_view
from ..schemas import AttributeIn, EquipIn, LevelIn, SkillIn
from ..security import current_user, locked_user
from .common import done

router = APIRouter(prefix="/api/characters", tags=["characters"])

TRAINING_ITEMS = ("manual_basico", "manual_avancado", "manual_elite", "cenoura", "cristal_habilidade",
                  "ferradura_bronze", "ferradura_prata", "ferradura_ouro")
EQUIPMENT = ("eq_sapatilha", "eq_fita", "eq_munhequeira", "eq_amuleto", "eq_oculos", "eq_coroa")


def _materials(db: Session, user: m.User) -> dict:
    return {
        "items": {i: {**item_public(i), "qty": get_qty(db, user.id, i)} for i in TRAINING_ITEMS},
        "equipment": [
            {**item_public(i), "qty": get_qty(db, user.id, i)}
            for i in EQUIPMENT if get_qty(db, user.id, i) > 0
        ],
        "attr_cost": describe(ATTR_TRAIN_COST),
    }


@router.get("")
def roster(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    return {"characters": [uc_view(uc) for uc in training.roster(db, user)], "catalog_total": len(CHAR_INFO)}


@router.get("/{uc_id}")
def detail(uc_id: int, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    uc = training.get_owned(db, user, uc_id)
    return {"character": uc_view(uc, full=True), "materials": _materials(db, user),
            "bio": char_bio(uc.character_id)}


def _after(db: Session, user: m.User, uc: m.UserCharacter, result: dict) -> dict:
    return done(db, user, {"result": result, "character": uc_view(uc, full=True),
                           "materials": _materials(db, user)})


@router.post("/{uc_id}/level")
def level(uc_id: int, body: LevelIn, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    uc = training.get_owned(db, user, uc_id)
    return _after(db, user, uc, training.level_up(db, user, uc, body.manuals))


@router.post("/{uc_id}/attribute")
def attribute(uc_id: int, body: AttributeIn, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    uc = training.get_owned(db, user, uc_id)
    return _after(db, user, uc, training.train_attribute(db, user, uc, body.stat, body.times))


@router.post("/{uc_id}/skill")
def skill(uc_id: int, body: SkillIn, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    uc = training.get_owned(db, user, uc_id)
    return _after(db, user, uc, training.upgrade_skill(db, user, uc, body.skill_id))


@router.post("/{uc_id}/ascend")
def ascend(uc_id: int, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    uc = training.get_owned(db, user, uc_id)
    return _after(db, user, uc, training.ascend(db, user, uc))


@router.post("/{uc_id}/equip")
def equip(uc_id: int, body: EquipIn, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    uc = training.get_owned(db, user, uc_id)
    return _after(db, user, uc, training.equip(db, user, uc, body.item_id))
