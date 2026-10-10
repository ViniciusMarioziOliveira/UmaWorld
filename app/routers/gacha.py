from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..game import gacha
from ..game.rewards import GameError
from ..schemas import ExchangeIn, PullIn
from ..security import current_user, locked_user
from .common import done

router = APIRouter(prefix="/api/gacha", tags=["gacha"])


@router.get("")
def banners(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    pity = {p.banner_type: p for p in db.scalars(select(m.PityState).where(m.PityState.user_id == user.id))}
    banners = gacha.current_banners().values()
    # Quem já pode trocar vê, em cada opção, se ela é nova ou vira despertar. Só nesse caso a tela
    # lê o despertar das personagens (uma consulta leve, sem montar a coleção).
    ready = any((s := gacha.spark_view(b, pity.get(b.type))) and s["ready"] for b in banners)
    awakening = dict(db.execute(select(m.UserCharacter.character_id, m.UserCharacter.awakening)
                                .where(m.UserCharacter.user_id == user.id)).all()) if ready else None
    return {
        "banners": [gacha.banner_view(b, pity.get(b.type), awakening) for b in banners],
        "recent_five_stars": gacha.recent_five_stars(db),
    }


@router.post("/pull")
def pull(body: PullIn, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    if body.banner is None:
        raise GameError("O jogo foi atualizado. Recarregue a página com Ctrl+F5 e faça o pull de novo.")
    return done(db, user, gacha.pull(db, user, body.banner, body.count))


@router.post("/exchange")
def exchange(body: ExchangeIn, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    return done(db, user, gacha.exchange(db, user, body.banner, body.character))


@router.get("/history")
def history(
    banner_type: str | None = Query(None, pattern="^(limited|standard)$"),
    rarity: int | None = Query(None, ge=3, le=5),
    page: int = Query(1, ge=1),
    user: m.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    return gacha.history(db, user, banner_type, rarity, page)
