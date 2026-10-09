from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..game import gacha
from ..game.rewards import GameError
from ..schemas import PullIn
from ..security import current_user, locked_user
from .common import done

router = APIRouter(prefix="/api/gacha", tags=["gacha"])


@router.get("")
def banners(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    pity = {p.banner_type: p for p in db.scalars(select(m.PityState).where(m.PityState.user_id == user.id))}
    return {
        "banners": [gacha.banner_view(b, pity.get(b.type)) for b in gacha.current_banners().values()],
        "recent_five_stars": gacha.recent_five_stars(db),
    }


@router.post("/pull")
def pull(body: PullIn, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    if body.banner is None:
        raise GameError("O jogo foi atualizado. Recarregue a página com Ctrl+F5 e faça o pull de novo.")
    return done(db, user, gacha.pull(db, user, body.banner, body.count))


@router.get("/history")
def history(
    banner_type: str | None = Query(None, pattern="^(limited|standard)$"),
    rarity: int | None = Query(None, ge=3, le=5),
    page: int = Query(1, ge=1),
    user: m.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    return gacha.history(db, user, banner_type, rarity, page)
