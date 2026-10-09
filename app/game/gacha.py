"""Gacha: banners, taxas, pity e 50/50. Todo sorteio acontece aqui, no servidor.

Regras (inspiradas nos gachas mais comuns):
- 5★: 0,6% base; a partir do pull 74 a chance sobe 6 p.p. por pull; garantido no 90.
- 4★ ou superior: 5,1% base; garantido a cada 10 pulls.
- Banners limitados: ao tirar 5★ há 50% de ser uma destacada. Se perder, a próxima 5★
  é garantidamente uma destacada. Com duas destacadas (Dupla Estelar), a que vem é
  sorteada entre as duas. 4★ tem 50% de ser uma das três destacadas.
- O pity é separado por tipo de banner. Os limitados (Holofote da semana e Dupla Estelar)
  dividem o mesmo, que continua valendo quando o destaque troca.
- De 1 a 10 pulls por vez. Tickets são gastos primeiro e o que faltar sai em carats
  (6 tickets + 600 carats fecham um 10x; com 6 tickets dá para fazer um 6x direto).
"""
import random
from dataclasses import asdict, dataclass

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from .. import models as m
from . import catalog, feed
from .clock import iso, next_weekly_reset, week_index, week_start_utc
from .registry import CHAR_INFO, char_public, chars_by
from .rewards import GameError, add_account_xp, get_qty, obtain_character, remove_item
from .tracking import track

PULL_COST_CARATS = 150
MAX_PULLS = 10
RATE_5 = 0.006
SOFT_PITY = 74
SOFT_STEP = 0.06
HARD_PITY = 90
RATE_4 = 0.051
PITY_4 = 10
FEATURED_4_COUNT = 3
ACCOUNT_XP_PER_PULL = 10

SERVER_MILESTONES = [100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000]

rng = random.SystemRandom()  # os testes trocam por um random.Random com seed


@dataclass
class Banner:
    key: str   # como a API e a tela chamam o banner
    id: str    # o que fica gravado em cada pull
    type: str  # "limited" ou "standard": decide as regras e o pity (os limitados dividem o mesmo)
    name: str
    subtitle: str
    featured5: list[str]
    featured4: list[str]
    starts_at: str | None
    ends_at: str | None


def current_banners() -> dict[str, Banner]:
    """Os banners abertos agora, pela chave da API: "limited", "duo" e "standard"."""
    week = week_index()
    duo_id, duo_name, duo5 = catalog.DUO_BANNER
    limited5 = [c["id"] for c in chars_by(5, "limited") if c["id"] not in duo5]
    fours = [c["id"] for c in chars_by(4)]
    star = limited5[week % len(limited5)]

    def featured4(offset: int) -> list[str]:
        start = (week * FEATURED_4_COUNT + offset) % len(fours)
        return [fours[(start + i) % len(fours)] for i in range(FEATURED_4_COUNT)]

    limited = Banner(
        key="limited",
        id=f"limited-w{week}",
        type="limited",
        name=f"Holofote: {CHAR_INFO[star]['name']}",
        subtitle="Chance aumentada da 5★ e das 4★ em destaque. Troca toda segunda-feira.",
        featured5=[star],
        featured4=featured4(0),
        starts_at=iso(week_start_utc()),
        ends_at=iso(next_weekly_reset()),
    )
    duo = Banner(
        key="duo",
        id=duo_id,
        type="limited",
        name=duo_name,
        subtitle=f"{' e '.join(CHAR_INFO[c]['name'] for c in duo5)} em destaque no mesmo banner. "
                 "O pity e a garantia são os mesmos do Holofote.",
        featured5=list(duo5),
        featured4=featured4(len(fours) // 2),  # 4★ diferentes das do Holofote, também semanais
        starts_at=None,
        ends_at=None,
    )
    standard = Banner(
        key="standard",
        id="standard",
        type="standard",
        name="Corrida das Lendas",
        subtitle="Banner permanente com todas as personagens do pool padrão.",
        featured5=[c["id"] for c in chars_by(5, "standard")],
        featured4=[],
        starts_at=None,
        ends_at=None,
    )
    return {"limited": limited, "duo": duo, "standard": standard}


def banner_label(banner_type: str, banner_id: str) -> str:
    """Nome curto do banner de um pull, para o histórico."""
    if banner_id == catalog.DUO_BANNER[0]:
        return catalog.DUO_BANNER[1]
    return "Holofote" if banner_type == "limited" else "Padrão"


def chance_5(pity: int) -> float:
    """`pity` = número deste pull desde o último 5★ (começa em 1)."""
    if pity >= HARD_PITY:
        return 1.0
    if pity >= SOFT_PITY:
        return min(1.0, RATE_5 + SOFT_STEP * (pity - SOFT_PITY + 1))
    return RATE_5


def get_pity(db: Session, user_id: int, banner_type: str) -> m.PityState:
    state = db.get(m.PityState, (user_id, banner_type))
    if state is None:
        state = m.PityState(user_id=user_id, banner_type=banner_type, pity5=0, pity4=0,
                            guaranteed=False, total=0)
        db.add(state)
        db.flush()
    return state


def pity_view(state: m.PityState | None) -> dict:
    return {
        "pity5": state.pity5 if state else 0,
        "pity4": state.pity4 if state else 0,
        "guaranteed": state.guaranteed if state else False,
        "total": state.total if state else 0,
        "hard_pity": HARD_PITY,
        "soft_pity": SOFT_PITY,
        "pity4_max": PITY_4,
    }


def banner_view(banner: Banner, state: m.PityState | None) -> dict:
    data = asdict(banner)
    data["featured5"] = [char_public(c) for c in banner.featured5]
    data["featured4"] = [char_public(c) for c in banner.featured4]
    data["pity"] = pity_view(state)
    data["cost"] = {"carats": PULL_COST_CARATS, "tickets": 1, "max": MAX_PULLS}
    data["rates"] = {
        "five": RATE_5, "four": RATE_4, "soft_pity": SOFT_PITY, "hard_pity": HARD_PITY,
        "pity4": PITY_4, "featured_chance": 0.5 if banner.type == "limited" else None,
    }
    five = [c["id"] for c in chars_by(5, "standard")]
    if banner.type == "limited":
        five += banner.featured5
    data["pool"] = {
        "five": [char_public(c) for c in five],
        "four": [char_public(c["id"]) for c in chars_by(4)],
        "three": [char_public(c["id"]) for c in chars_by(3)],
    }
    return data


def _roll(banner: Banner, state: m.PityState) -> tuple[str, int, bool, int]:
    """Um pull. Retorna (personagem, raridade, se é destaque, pity no momento)."""
    state.pity5 += 1
    state.pity4 += 1
    state.total += 1
    at_pity = state.pity5

    if rng.random() < chance_5(state.pity5):
        standard5 = [c["id"] for c in chars_by(5, "standard")]
        if banner.type == "limited":
            if state.guaranteed or rng.random() < 0.5:
                # Com mais de uma destacada (Dupla Estelar), a que vem é sorteada entre elas.
                cid, featured = rng.choice(banner.featured5), True
                state.guaranteed = False
            else:
                cid, featured = rng.choice(standard5), False
                state.guaranteed = True
        else:
            cid, featured = rng.choice(standard5), False
        state.pity5 = 0
        state.pity4 = 0
        return cid, 5, featured, at_pity

    if state.pity4 >= PITY_4 or rng.random() < RATE_4:
        state.pity4 = 0
        if banner.featured4 and rng.random() < 0.5:
            return rng.choice(banner.featured4), 4, True, at_pity
        return rng.choice([c["id"] for c in chars_by(4)]), 4, False, at_pity

    return rng.choice([c["id"] for c in chars_by(3)]), 3, False, at_pity


def _bump_server_pulls(db: Session, count: int) -> None:
    new_total = db.scalar(update(m.ServerStat).where(m.ServerStat.key == "total_pulls")
                          .values(value=m.ServerStat.value + count).returning(m.ServerStat.value))
    old_total = new_total - count
    marks = [x for x in SERVER_MILESTONES if old_total < x <= new_total]
    # Depois de 100.000, um marco a cada 100.000 pulls.
    step = 100_000
    marks += [x for x in range((old_total // step + 1) * step, new_total + 1, step) if x > SERVER_MILESTONES[-1]]
    for mark in marks:
        feed.emit(db, "milestone", "milestone", f"O servidor chegou a {feed.fmt(mark)} pulls!", data={"pulls": mark})


def pull_cost(tickets: int, count: int) -> dict:
    """Tickets primeiro; cada pull que faltar custa PULL_COST_CARATS."""
    use = min(tickets, count)
    return {"tickets": use, "carats": (count - use) * PULL_COST_CARATS}


def pull(db: Session, user: m.User, banner_key: str, count: int) -> dict:
    if not 1 <= count <= MAX_PULLS:
        raise GameError(f"Dá para fazer de 1 a {MAX_PULLS} pulls por vez.")
    banner = current_banners().get(banner_key)
    if banner is None:
        raise GameError("Esse banner não está aberto.")

    tickets = get_qty(db, user.id, "ticket")
    paid = pull_cost(tickets, count)
    if user.carats < paid["carats"]:
        if tickets:
            raise GameError(f"Carats insuficientes: {count} pulls custam {tickets} ticket(s) "
                            f"+ {feed.fmt(paid['carats'])} carats.")
        raise GameError(f"Você precisa de {count} ticket(s) ou {feed.fmt(PULL_COST_CARATS * count)} carats.")
    if paid["tickets"]:
        remove_item(db, user.id, "ticket", paid["tickets"])
    user.carats -= paid["carats"]

    state = get_pity(db, user.id, banner.type)
    results = []
    for _ in range(count):
        cid, rarity, featured, at_pity = _roll(banner, state)
        outcome = obtain_character(db, user, cid)
        db.add(m.Pull(user_id=user.id, banner_type=banner.type, banner_id=banner.id, character_id=cid,
                      rarity=rarity, pity=at_pity, featured=featured, outcome=outcome["status"]))
        results.append({
            "character": char_public(cid),
            "rarity": rarity,
            "featured": featured,
            "pity": at_pity,
            "outcome": outcome["status"],
            "awakening": outcome["awakening"],
            "fragments": outcome["fragments"],
        })
        if rarity == 5:
            user.five_star_count += 1
            feed.emit(db, "five_star", "star-burst",
                      f"conseguiu {feed.char_tag(CHAR_INFO[cid]['name'], 5)} com {at_pity} pity.", user,
                      {"character": cid, "pity": at_pity, "featured": featured, "banner": banner.key})

    user.total_pulls += count
    five_count = sum(1 for r in results if r["rarity"] == 5)
    track(db, user, "pull", count)
    track(db, user, "five_star", five_count)
    add_account_xp(db, user, ACCOUNT_XP_PER_PULL * count)
    _bump_server_pulls(db, count)

    return {"banner": banner.key, "banner_type": banner.type, "results": results, "paid": paid,
            "pity": pity_view(state)}


def history(db: Session, user: m.User, banner_type: str | None, rarity: int | None,
            page: int, page_size: int = 20) -> dict:
    q = select(m.Pull).where(m.Pull.user_id == user.id)
    if banner_type:
        q = q.where(m.Pull.banner_type == banner_type)
    if rarity:
        q = q.where(m.Pull.rarity == rarity)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(m.Pull.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {
        "page": page,
        "pages": max(1, -(-total // page_size)),
        "total": total,
        "items": [
            {
                "id": p.id,
                "character": char_public(p.character_id),
                "rarity": p.rarity,
                "banner_type": p.banner_type,
                "banner_label": banner_label(p.banner_type, p.banner_id),
                "pity": p.pity,
                "featured": p.featured,
                "outcome": p.outcome,
                "created_at": iso(p.created_at),
            }
            for p in rows
        ],
    }


def recent_five_stars(db: Session, limit: int = 8) -> list[dict]:
    rows = db.execute(
        select(m.Pull, m.User.nickname)
        .join(m.User, m.User.id == m.Pull.user_id)
        .where(m.Pull.rarity == 5)
        .order_by(m.Pull.id.desc())
        .limit(limit)
    ).all()
    return [
        {"nickname": nick, "character": char_public(p.character_id), "pity": p.pity,
         "featured": p.featured, "created_at": iso(p.created_at)}
        for p, nick in rows
    ]
