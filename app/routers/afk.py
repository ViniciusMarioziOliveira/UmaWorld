from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..game import afk
from ..schemas import HelpersIn, UpgradeIn
from ..security import current_user, locked_user
from .common import done

router = APIRouter(prefix="/api/afk", tags=["afk"])


@router.get("")
def view(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    data = afk.view(db, user)
    db.commit()  # a fazenda é criada na primeira visita, se ainda não existir
    return data


def _with_view(db: Session, user: m.User, result: dict) -> dict:
    db.flush()  # a tela consulta as ajudantes no banco: a troca de equipe precisa estar lá
    result["farm"] = afk.view(db, user)
    return done(db, user, result)


@router.post("/collect")
def collect(user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    return _with_view(db, user, afk.collect(db, user))


@router.post("/upgrade")
def upgrade(body: UpgradeIn, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    return _with_view(db, user, afk.upgrade(db, user, body.kind))


@router.post("/helpers")
def helpers(body: HelpersIn, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    return _with_view(db, user, afk.set_helpers(db, user, body.slots))
