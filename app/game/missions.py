"""Missões diárias, semanais e conquistas."""
from sqlalchemy.orm import Session

from .. import models as m
from . import feed
from .clock import day_key, iso, next_daily_reset, next_weekly_reset, utcnow
from .registry import MISSION_BY_ID, MISSIONS, MissionInfo
from .rewards import GameError, describe, grant
from .tracking import progress_row, track

CATEGORIES = ("daily", "weekly", "achievement")


def _view(mission: MissionInfo, row: m.UserMission | None) -> dict:
    progress = row.progress if row else 0
    claimed = bool(row and row.claimed_at)
    return {
        "id": mission.id,
        "category": mission.category,
        "icon": mission.icon,
        "title": mission.title,
        "description": mission.description,
        "progress": min(progress, mission.target),
        "target": mission.target,
        "rewards": describe(mission.rewards),
        "claimed": claimed,
        "claimed_at": iso(row.claimed_at) if claimed else None,
        "claimable": not claimed and progress >= mission.target,
    }


def list_view(db: Session, user: m.User) -> dict:
    out = {c: [] for c in CATEGORIES}
    for mission in MISSIONS:
        row = progress_row(db, user.id, mission, create=False)
        out[mission.category].append(_view(mission, row))
    out["resets"] = {"daily": iso(next_daily_reset()), "weekly": iso(next_weekly_reset())}
    return out


def claimable_count(db: Session, user: m.User) -> int:
    count = 0
    for mission in MISSIONS:
        row = progress_row(db, user.id, mission, create=False)
        if row and not row.claimed_at and row.progress >= mission.target:
            count += 1
    return count


def _claim(db: Session, user: m.User, mission: MissionInfo) -> list[dict] | None:
    row = progress_row(db, user.id, mission, create=False)
    if row is None or row.claimed_at or row.progress < mission.target:
        return None
    row.claimed_at = utcnow()
    result = grant(db, user, mission.rewards)
    if mission.category == "daily" and mission.event != "daily_claim":
        track(db, user, "daily_claim", 1)
    if mission.category == "achievement":
        feed.emit(db, "achievement", "achievement", f"desbloqueou a conquista “{mission.title}”.", user,
                  {"mission": mission.id})
    return result["rewards"]


def claim(db: Session, user: m.User, mission_id: str) -> dict:
    mission = MISSION_BY_ID.get(mission_id)
    if mission is None:
        raise GameError("Missão não encontrada.")
    rewards = _claim(db, user, mission)
    if rewards is None:
        raise GameError("Esta missão ainda não pode ser resgatada.")
    return {"rewards": rewards}


def claim_all(db: Session, user: m.User, category: str) -> dict:
    collected: list[dict] = []
    claimed = 0
    # A missão "Dever cumprido" depende das outras, por isso fica para o fim.
    missions = sorted(
        (x for x in MISSIONS if x.category == category),
        key=lambda x: x.event == "daily_claim",
    )
    for mission in missions:
        rewards = _claim(db, user, mission)
        if rewards is not None:
            claimed += 1
            collected.extend(rewards)
    if not claimed:
        raise GameError("Nenhuma missão pronta para resgate.")
    return {"claimed": claimed, "rewards": _merge(collected)}


def _merge(rewards: list[dict]) -> list[dict]:
    merged: dict[tuple, dict] = {}
    for r in rewards:
        key = (r["kind"], r.get("id"))
        if key in merged:
            merged[key]["qty"] += r["qty"]
        else:
            merged[key] = dict(r)
    return list(merged.values())


def record_login(db: Session, user: m.User) -> None:
    today = day_key()
    if user.last_login_day != today:
        user.last_login_day = today
        track(db, user, "login", 1)
