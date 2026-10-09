"""Relógio do jogo: horário UTC no banco, resets diários/semanais no fuso do jogo."""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from ..config import GAME_TIMEZONE

TZ = ZoneInfo(GAME_TIMEZONE)
# Segunda-feira usada como "semana 0" para a rotação dos banners.
ROTATION_EPOCH = date(2024, 1, 1)


def utcnow() -> datetime:
    """UTC sem tzinfo — é assim que tudo é gravado no banco."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat(timespec="seconds") + "Z" if dt else None


def local_now() -> datetime:
    return datetime.now(TZ)


def _to_utc_naive(local_dt: datetime) -> datetime:
    return local_dt.astimezone(timezone.utc).replace(tzinfo=None)


def day_key() -> str:
    return local_now().date().isoformat()


def week_key() -> str:
    year, week, _ = local_now().date().isocalendar()
    return f"{year}-W{week:02d}"


def period_key(period: str | None) -> str:
    """Chave usada para separar progresso/limites por período."""
    if period == "daily":
        return day_key()
    if period == "weekly":
        return week_key()
    return "all"


def today_start_utc() -> datetime:
    today = local_now().date()
    return _to_utc_naive(datetime.combine(today, time.min, tzinfo=TZ))


def next_daily_reset() -> datetime:
    tomorrow = local_now().date() + timedelta(days=1)
    return _to_utc_naive(datetime.combine(tomorrow, time.min, tzinfo=TZ))


def week_start_local_date() -> date:
    today = local_now().date()
    return today - timedelta(days=today.weekday())


def next_weekly_reset() -> datetime:
    next_monday = week_start_local_date() + timedelta(days=7)
    return _to_utc_naive(datetime.combine(next_monday, time.min, tzinfo=TZ))


def week_index() -> int:
    """Quantas semanas se passaram desde ROTATION_EPOCH (define o banner da semana)."""
    return (week_start_local_date() - ROTATION_EPOCH).days // 7


def week_start_utc() -> datetime:
    return _to_utc_naive(datetime.combine(week_start_local_date(), time.min, tzinfo=TZ))
