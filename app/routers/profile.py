"""Perfil / Casa do Jogador."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..game import catalog, training
from ..game.clock import iso
from ..game.feed import fmt
from ..game.registry import CHAR_INFO, ITEM_INFO, MISSIONS, char_public, item_public
from ..game.rewards import CURRENCIES, GameError, get_qty
from ..game.serializers import avatar_view, public_user, uc_view
from ..realtime import hub
from ..schemas import ProfileIn
from ..security import current_user, locked_user
from .common import done

router = APIRouter(prefix="/api/profile", tags=["profile"])

# De onde vem cada cosmético (Loja ou conquista), para quem ainda não tem saber como conseguir.
COSMETIC_SOURCES: dict[str, list[str]] = {}
for _oid, _tab, _rewards, _currency, _price, _period, _limit in catalog.SHOP_OFFERS:
    for _item in _rewards.get("items", {}):
        COSMETIC_SOURCES.setdefault(_item, []).append(f"Loja: {fmt(_price)} {CURRENCIES[_currency][0]}")
for _mission in MISSIONS:
    for _item in _mission.rewards.get("items", {}):
        COSMETIC_SOURCES.setdefault(_item, []).append(f"Conquista: {_mission.title}")


@router.get("/{nickname}")
def profile(nickname: str, viewer: m.User = Depends(current_user), db: Session = Depends(get_db)):
    user = db.scalar(select(m.User).where(m.User.nickname_key == nickname.lower()))
    if user is None:
        raise HTTPException(404, "Jogador não encontrado.")
    roster = training.roster(db, user)
    owned = {uc.character_id: uc for uc in roster}
    favorites = sorted((uc for uc in roster if uc.favorite_slot), key=lambda uc: uc.favorite_slot)

    four_star_count, best_pity = db.execute(
        select(func.count().filter(m.Pull.rarity == 4), func.min(m.Pull.pity).filter(m.Pull.rarity == 5))
        .where(m.Pull.user_id == user.id)
    ).one()
    achievements = db.execute(
        select(m.Mission, m.UserMission.claimed_at)
        .outerjoin(m.UserMission, (m.UserMission.mission_id == m.Mission.id)
                   & (m.UserMission.user_id == user.id) & (m.UserMission.period_key == "all"))
        .where(m.Mission.category == "achievement")
        .order_by(m.Mission.sort)
    ).all()

    data = {
        **public_user(user),
        "is_me": user.id == viewer.id,
        "avatar": avatar_view(db, user),
        "created_at": iso(user.created_at),
        "last_seen_at": iso(user.last_seen_at),
        "favorites": [uc_view(uc) for uc in favorites],
        "stats": {
            "total_pulls": user.total_pulls,
            "five_star_count": user.five_star_count,
            "four_star_count": four_star_count,
            "best_pity": best_pity,
            "afk_collections": user.afk_collections,
            "collection": len(owned),
            "collection_total": len(CHAR_INFO),
            "max_power": max((uc.power for uc in roster), default=0),
            "total_power": sum(uc.power for uc in roster),
        },
        "achievements": [
            {"id": mission.id, "icon": mission.icon, "title": mission.title,
             "description": mission.description, "unlocked": claimed_at is not None,
             "unlocked_at": iso(claimed_at)}
            for mission, claimed_at in achievements
        ],
        "collection": [
            {**char_public(cid), "owned": cid in owned,
             "awakening": owned[cid].awakening if cid in owned else 0,
             "level": owned[cid].level if cid in owned else 0}
            for cid in sorted(CHAR_INFO, key=lambda c: (-CHAR_INFO[c]["rarity"], CHAR_INFO[c]["name"]))
        ],
    }
    if data["is_me"]:
        # Todos os títulos e molduras do jogo, com os que o jogador tem marcados (o inventário
        # inteiro vem numa consulta só). A tela mostra os que faltam com o caminho para consegui-los.
        data["cosmetics"] = {
            cat: [{**item_public(i), "owned": get_qty(db, user.id, i) > 0, "sources": COSMETIC_SOURCES.get(i, [])}
                  for i, info in ITEM_INFO.items() if info["category"] == cat]
            for cat in ("title", "frame")
        }
        data["roster"] = [uc_view(uc) for uc in roster]
    return data


@router.put("")
def update_profile(body: ProfileIn, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    fields = body.model_fields_set

    if "avatar_uc_id" in fields and body.avatar_uc_id is not None:
        uc = db.get(m.UserCharacter, body.avatar_uc_id)
        if uc is None or uc.user_id != user.id:
            raise GameError("Personagem não encontrada no seu estábulo.")
        user.avatar_character_id = uc.character_id
        hub.update_viewer(user.id, avatar=uc.character_id)  # os outros veem a troca na Praça

    for field, category in (("title_item_id", "title"), ("frame_item_id", "frame")):
        if field not in fields:
            continue
        item_id = getattr(body, field)
        if item_id is not None:
            if ITEM_INFO.get(item_id, {}).get("category") != category or get_qty(db, user.id, item_id) < 1:
                raise GameError("Você não possui este cosmético.")
        setattr(user, field, item_id)

    if "favorites" in fields and body.favorites is not None:
        ids = body.favorites
        if len(ids) != len(set(ids)):
            raise GameError("Favoritas repetidas.")
        roster = {uc.id: uc for uc in training.roster(db, user)}
        if any(i not in roster for i in ids):
            raise GameError("Personagem não encontrada no seu estábulo.")
        for uc in roster.values():
            uc.favorite_slot = None
        for slot, uc_id in enumerate(ids, start=1):
            roster[uc_id].favorite_slot = slot

    db.flush()
    db.refresh(user, ["title", "frame"])
    return done(db, user, {"ok": True})
