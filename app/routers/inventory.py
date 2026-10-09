"""Inventário / Armazém."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..game import training
from ..game.registry import CHAR_INFO, item_public
from ..game.rewards import CURRENCIES
from ..game.serializers import uc_view
from ..security import current_user

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

CATEGORY_LABELS = {
    "ticket": "Tickets",
    "xp": "Manuais de XP",
    "material": "Materiais",
    "equipment": "Equipamentos",
    "frame": "Molduras",
    "title": "Títulos",
}


@router.get("")
def inventory(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(m.InventoryItem).where(m.InventoryItem.user_id == user.id, m.InventoryItem.qty > 0)
    ).all()
    items = sorted(
        ({**item_public(r.item_id), "qty": r.qty, "sort": r.item.sort} for r in rows),
        key=lambda i: i["sort"],
    )
    # Equipamentos em uso aparecem também, marcados como equipados.
    equipped = [
        {"item": item_public(uc.equipment_item_id), "character": CHAR_INFO[uc.character_id]["name"]}
        for uc in training.roster(db, user) if uc.equipment_item_id
    ]
    return {
        "currencies": [
            {"key": key, "name": label, "icon": icon, "qty": getattr(user, key)}
            for key, (label, icon) in CURRENCIES.items()
        ],
        "categories": CATEGORY_LABELS,
        "items": items,
        "equipped": equipped,
        "characters": [uc_view(uc) for uc in training.roster(db, user)],
        "catalog_total": len(CHAR_INFO),
    }
