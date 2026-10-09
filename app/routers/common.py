from sqlalchemy.orm import Session

from .. import models as m
from ..game import afk, missions
from ..game.clock import utcnow
from ..game.serializers import user_summary


def done(db: Session, user: m.User, payload: dict) -> dict:
    """Fecha a ação: resumo atualizado do jogador (o HUD usa para atualizar saldos) + commit.

    Tudo o que a resposta precisa é lido antes do commit, na mesma transação. Uma leitura
    depois dele abriria outra transação, com mais idas ao banco. Por isso quem acrescenta
    algo à resposta (a lista da Loja, das missões...) faz isso antes de chamar `done`.
    """
    db.flush()  # personagens novas ganham id antes do resumo
    payload["me"] = user_summary(db, user)
    db.commit()
    return payload


def badges(db: Session, user: m.User) -> dict:
    """Avisos que aparecem no mapa/HUD: missões para resgatar e estado da Farm AFK."""
    farm = afk.get_farm(db, user)
    elapsed, hours = afk.accrued_hours(farm, utcnow())
    return {
        "missions": missions.claimable_count(db, user),
        "afk_hours": round(hours, 2),
        "afk_storage_hours": afk.storage_hours(farm.storage_level),
        "afk_full": elapsed >= afk.storage_hours(farm.storage_level),
        "afk_ready": elapsed * 60 >= afk.MIN_COLLECT_MINUTES,
    }
