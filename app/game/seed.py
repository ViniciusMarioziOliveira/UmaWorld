"""Copia o catálogo de catalog.py para o banco (upsert por id). Roda a cada inicialização."""
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from .. import models as m
from . import catalog
from .registry import CHAR_INFO, ITEM_INFO, MISSIONS

SERVER_STAT_KEYS = ("total_pulls",)
CATALOG_TABLES = (m.Skill, m.Character, m.CharacterSkill, m.Item, m.Mission, m.ShopOffer,
                  m.Announcement, m.ServerStat)


def _offer_display(rewards: dict) -> tuple[str, str, int]:
    """Nome, ícone e raridade de uma oferta, derivados da recompensa."""
    if "character" in rewards:
        c = CHAR_INFO[rewards["character"]]
        return c["name"], "horse", c["rarity"]
    if "coins" in rewards:
        return f"Bolsa com {rewards['coins']:,} moedas".replace(",", "."), "coin-bag", 3
    (item_id, qty), = rewards["items"].items()
    item = ITEM_INFO[item_id]
    name = item["name"] if qty == 1 else f"{item['name']} x{qty}"
    return name, item["icon"], item["rarity"]


def seed(db: Session) -> None:
    # Uma consulta por tabela traz o catálogo que já está no banco. Cada linha é comparada na
    # memória e só o que mudou (ou é novo) é gravado, em vez de uma consulta por linha
    # (com o servidor longe do banco, isso deixava a inicialização em mais de 30 segundos).
    stored = {model: {inspect(obj).identity: obj for obj in db.scalars(select(model))}
              for model in CATALOG_TABLES}

    def put(obj) -> None:
        """Atualiza a linha que já existe ou cria uma nova."""
        key = tuple(inspect(type(obj)).primary_key_from_instance(obj))
        if key in stored[type(obj)]:
            db.merge(obj)
        else:
            db.add(obj)

    for (sid, name, desc) in catalog.GENERIC_SKILLS.values():
        put(m.Skill(id=sid, name=name, description=desc, kind="generic", power_bonus=catalog.GENERIC_SKILL_BONUS))

    for (cid, name, rarity, distance, style, color, pool, skill_name, skill_desc) in catalog.CHARACTERS:
        base = CHAR_INFO[cid]["base"]
        put(m.Character(
            id=cid, name=name, rarity=rarity, distance=distance, style=style, color=color, pool=pool,
            base_speed=base["speed"], base_stamina=base["stamina"], base_power=base["power"],
            base_guts=base["guts"], base_wit=base["wit"],
        ))
        unique_id = CHAR_INFO[cid]["unique_skill"]
        put(m.Skill(id=unique_id, name=skill_name, description=skill_desc, kind="unique",
                    power_bonus=catalog.UNIQUE_SKILL_BONUS[rarity]))
        put(m.CharacterSkill(character_id=cid, skill_id=unique_id, slot=1))
        put(m.CharacterSkill(character_id=cid, skill_id=CHAR_INFO[cid]["generic_skill"], slot=2))

    for info in ITEM_INFO.values():
        put(m.Item(id=info["id"], name=info["name"], category=info["category"], rarity=info["rarity"],
                   icon=info["icon"], description=info["description"], data=info["data"], sort=info["sort"]))

    for x in MISSIONS:
        put(m.Mission(id=x.id, category=x.category, icon=x.icon, title=x.title, description=x.description,
                      event=x.event, mode=x.mode, target=x.target, rewards=x.rewards, sort=x.sort))

    for sort, (oid, tab, rewards, currency, price, period, limit) in enumerate(catalog.SHOP_OFFERS):
        name, icon, rarity = _offer_display(rewards)
        put(m.ShopOffer(id=oid, tab=tab, name=name, icon=icon, rarity=rarity, rewards=rewards,
                        currency=currency, price=price, limit_period=period, limit_count=limit, sort=sort))

    # Avisos: a data de criação de um aviso que já existe não muda.
    for (aid, icon, title, body, pinned) in catalog.ANNOUNCEMENTS:
        current = stored[m.Announcement].get((aid,))
        if current is None:
            db.add(m.Announcement(id=aid, icon=icon, title=title, body=body, pinned=pinned))
        else:
            current.icon, current.title, current.body, current.pinned = icon, title, body, pinned

    for key in SERVER_STAT_KEYS:
        if (key,) not in stored[m.ServerStat]:
            db.add(m.ServerStat(key=key, value=0))
