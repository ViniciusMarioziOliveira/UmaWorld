"""Preparação do banco: migrações leves, tabelas, proteção (RLS) e catálogo.

O projeto usa `create_all` (sem Alembic): tabelas novas são criadas sozinhas, mas
colunas novas em tabelas existentes não. `migrate` cobre essas diferenças.
"""
import logging

from sqlalchemy import bindparam, inspect, text
from sqlalchemy.engine import Connection, Engine

from . import models  # noqa: F401  (registra as tabelas no metadata)
from .database import Base, SessionLocal, engine
from .game.gacha import SPARK_COST
from .game.seed import seed

log = logging.getLogger("umaworld.migrate")

# Versão 1 gravava emojis no feed; a versão 2 usa nomes de ícones.
LEGACY_FEED_ICONS = {
    "🌟": "star-burst", "🏆": "rank-up", "📈": "milestone", "💫": "awakening", "✨": "ascension",
    "🏅": "achievement", "🛒": "bag", "👋": "wave", "🚜": "farmer",
}
ICON_TABLES = ("items", "missions", "shop_offers", "announcements", "feed_events")


def migrate(conn: Connection, tables: set[str]) -> None:
    if "users" not in tables:
        return  # banco novo: create_all cria tudo no formato atual

    # As colunas das duas tabelas numa leitura só (cada ida ao banco conta na inicialização).
    columns = {table: {c["name"] for c in cols} for (_, table), cols in
               inspect(conn).get_multi_columns(filter_names=["users", "pity"]).items()}
    if "avatar_character_id" not in columns["users"]:
        conn.execute(text("ALTER TABLE users ADD COLUMN avatar_character_id VARCHAR(40)"))
        log.info("Coluna users.avatar_character_id criada.")

    if "pity" in columns and "spark" not in columns["pity"]:
        conn.execute(text("ALTER TABLE pity ADD COLUMN spark INTEGER NOT NULL DEFAULT 0"))
        conn.execute(text("ALTER TABLE pity ADD COLUMN exchanges INTEGER NOT NULL DEFAULT 0"))
        # Os pulls feitos antes da troca existir também contam, até uma troca.
        conn.execute(text("UPDATE pity SET spark = CASE WHEN total > :cost THEN :cost ELSE total END"),
                     {"cost": SPARK_COST})
        log.info("Colunas pity.spark e pity.exchanges criadas.")

    if conn.dialect.name == "postgresql":
        # SQLite não limita VARCHAR; no PostgreSQL as colunas de ícone precisam crescer.
        short = conn.execute(
            text("SELECT table_name FROM information_schema.columns WHERE table_schema = current_schema() "
                 "AND column_name = 'icon' AND character_maximum_length < 40 AND table_name = ANY(:names)"),
            {"names": list(ICON_TABLES)},
        ).scalars().all()
        for table in short:
            conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN icon TYPE VARCHAR(40)"))

    if "feed_events" in tables:
        legacy = list(LEGACY_FEED_ICONS)
        old = conn.execute(
            text("SELECT 1 FROM feed_events WHERE icon IN :emojis OR message LIKE '%⭐%' LIMIT 1")
            .bindparams(bindparam("emojis", expanding=True)),
            {"emojis": legacy},
        ).first()
        if old:
            for emoji, name in LEGACY_FEED_ICONS.items():
                conn.execute(text("UPDATE feed_events SET icon = :name WHERE icon = :emoji"),
                             {"name": name, "emoji": emoji})
            conn.execute(text("UPDATE feed_events SET message = REPLACE(message, '⭐', '★') "
                              "WHERE message LIKE '%⭐%'"))


def protect_tables(conn: Connection) -> None:
    """Liga o RLS (Row Level Security) nas tabelas do jogo, no PostgreSQL.

    O Supabase publica as tabelas do schema `public` numa API REST (Data API). Com RLS
    ligado e nenhuma política, essa API não lê nem grava nada. O jogo não é afetado:
    ele conecta como dono das tabelas, e o dono não passa pelo RLS.
    """
    if conn.dialect.name != "postgresql":
        return
    exposed = conn.execute(
        text("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
             "WHERE n.nspname = current_schema() AND c.relkind = 'r' "
             "AND NOT c.relrowsecurity AND c.relname = ANY(:names)"),
        {"names": list(Base.metadata.tables)},
    ).scalars().all()
    for table in exposed:
        conn.execute(text(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY'))
    if exposed:
        log.info("RLS ligado em %d tabelas.", len(exposed))


def upgrade_schema(target: Engine) -> None:
    """Migrações leves, tabelas novas e RLS, numa transação só."""
    with target.begin() as conn:
        tables = set(inspect(conn).get_table_names())
        migrate(conn, tables)
        if not set(Base.metadata.tables) <= tables:
            Base.metadata.create_all(conn)
        protect_tables(conn)


def prepare_database() -> None:
    """Deixa o banco pronto para o jogo. Roda a cada inicialização e pode repetir sem efeito.

    No plano grátis do Render o servidor dorme e liga de novo a cada visita depois de um
    tempo parado, então isto aqui faz o mínimo de consultas: quase tudo já está pronto.
    """
    upgrade_schema(engine)
    with SessionLocal() as db:
        seed(db)
        db.commit()
