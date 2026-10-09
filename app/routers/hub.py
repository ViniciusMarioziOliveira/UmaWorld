"""Praça Central: eventos ativos, avisos, estatísticas do servidor e jogadores online."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..game import feed, gacha
from ..game.clock import iso, next_daily_reset, next_weekly_reset, today_start_utc
from ..game.registry import char_public, npc_public
from ..realtime import hub
from ..security import current_user
from .common import badges

router = APIRouter(prefix="/api", tags=["hub"])


@router.get("/hub")
def hub_view(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    banners = gacha.current_banners()
    limited, duo = banners["limited"], banners["duo"]
    announcements = db.scalars(
        select(m.Announcement).order_by(m.Announcement.pinned.desc(), m.Announcement.id.desc()).limit(10)
    ).all()
    # Os três números do servidor numa consulta só.
    players, total_pulls, five_today = db.execute(select(
        select(func.count()).select_from(m.User).scalar_subquery(),
        select(m.ServerStat.value).where(m.ServerStat.key == "total_pulls").scalar_subquery(),
        select(func.count()).select_from(m.Pull)
        .where(m.Pull.rarity == 5, m.Pull.created_at >= today_start_utc()).scalar_subquery(),
    )).one()
    return {
        "events": [
            {
                "kind": "banner",
                "icon": "dice",
                "title": limited.name,
                "description": limited.subtitle,
                "character": char_public(limited.featured5[0]),
                "ends_at": limited.ends_at,
                "link": "gacha",
            },
            {
                "kind": "banner",
                "icon": "sparkle",
                "title": duo.name,
                "description": duo.subtitle,
                "character": char_public(duo.featured5[0]),
                "characters": [char_public(c) for c in duo.featured5],
                "ends_at": duo.ends_at,
                "link": "gacha/duo",
            },
            {"kind": "reset", "icon": "sunrise", "title": "Reset das missões diárias",
             "description": "Missões diárias e limites diários da Loja renovam.",
             "ends_at": iso(next_daily_reset()), "link": "missoes"},
            {"kind": "reset", "icon": "calendar", "title": "Reset semanal",
             "description": "Missões semanais, Loja semanal e novo banner em destaque.",
             "ends_at": iso(next_weekly_reset()), "link": "missoes"},
        ],
        "announcements": [
            {"id": a.id, "icon": a.icon, "title": a.title, "body": a.body, "pinned": a.pinned,
             "created_at": iso(a.created_at)}
            for a in announcements
        ],
        "stats": {"players": players, "total_pulls": total_pulls or 0, "five_stars_today": five_today},
        "online": hub.online_players(),
        "npcs": npc_public(),
        "recent_five_stars": gacha.recent_five_stars(db, limit=5),
        "badges": badges(db, user),
    }


@router.get("/feed")
def feed_view(limit: int = Query(50, ge=1, le=100), db: Session = Depends(get_db)):
    """Público: a tela de login também mostra o Chat Global."""
    return {"events": feed.recent(db, limit)}
