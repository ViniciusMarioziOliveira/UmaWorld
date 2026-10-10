"""Loja: ofertas com preço, moeda e limite por período (diário, semanal, único)."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..database import session_cache
from . import feed
from .catalog import COSMETIC_CATEGORIES
from .clock import iso, next_daily_reset, next_weekly_reset, period_key
from .registry import CHAR_INFO, ITEM_INFO, char_public
from .rewards import GameError, describe, get_qty, grant, pay
from .tracking import track

TABS = {
    "moedas": "Moedas",
    "carats": "Carats",
    "fragmentos": "Fragmentos",
    "cosmeticos": "Cosméticos",
}


def _purchases(db: Session, user_id: int) -> dict[tuple[str, str], m.Purchase]:
    """As compras do jogador nos períodos atuais (hoje, esta semana e as únicas), numa consulta só."""
    def load():
        periods = {period_key(p) for p in ("daily", "weekly", None)}
        rows = db.scalars(select(m.Purchase).where(m.Purchase.user_id == user_id, m.Purchase.period_key.in_(periods)))
        return {(r.offer_id, r.period_key): r for r in rows}
    return session_cache(db, ("purchases", user_id), load)


def _bought(db: Session, user_id: int, offer: m.ShopOffer) -> int:
    row = _purchases(db, user_id).get((offer.id, period_key(offer.limit_period)))
    return row.count if row else 0


def _cosmetic_owned(db: Session, user_id: int, offer: m.ShopOffer) -> bool:
    items = offer.rewards.get("items", {})
    return any(ITEM_INFO[i]["category"] in COSMETIC_CATEGORIES and get_qty(db, user_id, i) > 0 for i in items)


def list_view(db: Session, user: m.User) -> dict:
    offers = db.scalars(select(m.ShopOffer).order_by(m.ShopOffer.sort)).all()
    out = []
    for offer in offers:
        bought = _bought(db, user.id, offer)
        remaining = None if offer.limit_count is None else max(0, offer.limit_count - bought)
        entry = {
            "id": offer.id,
            "tab": offer.tab,
            "name": offer.name,
            "icon": offer.icon,
            "rarity": offer.rarity,
            "currency": offer.currency,
            "price": offer.price,
            "limit_period": offer.limit_period,
            "limit_count": offer.limit_count,
            "remaining": remaining,
            "owned": _cosmetic_owned(db, user.id, offer),
            "rewards": describe(offer.rewards),
        }
        if "character" in offer.rewards:
            entry["character"] = char_public(offer.rewards["character"])
        elif offer.rewards.get("items"):
            (item_id, _), = offer.rewards["items"].items()
            entry["description"] = ITEM_INFO[item_id]["description"]
            if ITEM_INFO[item_id]["category"] == "frame":
                entry["frame"] = ITEM_INFO[item_id]["data"]["css"]  # a Loja mostra a moldura no seu avatar
        out.append(entry)
    return {
        "tabs": TABS,
        "offers": out,
        "resets": {"daily": iso(next_daily_reset()), "weekly": iso(next_weekly_reset())},
    }


def buy(db: Session, user: m.User, offer_id: str, quantity: int) -> dict:
    offer = db.get(m.ShopOffer, offer_id)
    if offer is None:
        raise GameError("Oferta não encontrada.")
    if quantity < 1:
        raise GameError("Quantidade inválida.")
    if _cosmetic_owned(db, user.id, offer):
        raise GameError("Você já possui este cosmético.")

    key = period_key(offer.limit_period)
    purchases = _purchases(db, user.id)
    row = purchases.get((offer.id, key))
    bought = row.count if row else 0
    if offer.limit_count is not None and bought + quantity > offer.limit_count:
        left = max(0, offer.limit_count - bought)
        raise GameError(f"Limite atingido: restam {left} compra(s) neste período.")

    pay(db, user, {offer.currency: offer.price}, times=quantity)
    result = grant(db, user, offer.rewards, times=quantity)

    if row is None:
        row = purchases[(offer.id, key)] = m.Purchase(user_id=user.id, offer_id=offer.id, period_key=key, count=0)
        db.add(row)
    row.count = bought + quantity
    track(db, user, "shop_buy", quantity)

    cid = offer.rewards.get("character")
    if cid and CHAR_INFO[cid]["rarity"] == 5:
        feed.emit(db, "shop_character", "bag",
                  f"trocou fragmentos por {feed.char_tag(CHAR_INFO[cid]['name'], 5)} na Loja.", user,
                  {"character": cid})
    return {"rewards": result["rewards"], "characters": result["characters"]}
