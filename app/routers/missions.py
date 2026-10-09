from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..game import missions
from ..schemas import ClaimAllIn
from ..security import current_user, locked_user
from .common import done

router = APIRouter(prefix="/api/missions", tags=["missions"])


@router.get("")
def list_missions(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    return missions.list_view(db, user)


def _with_list(db: Session, user: m.User, result: dict) -> dict:
    result["missions"] = missions.list_view(db, user)
    return done(db, user, result)


@router.post("/claim-all")
def claim_all(body: ClaimAllIn, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    return _with_list(db, user, missions.claim_all(db, user, body.category))


@router.post("/{mission_id}/claim")
def claim(mission_id: str, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    return _with_list(db, user, missions.claim(db, user, mission_id))
