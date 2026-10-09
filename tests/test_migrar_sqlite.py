from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app import models as m
from app.database import Base, engine
from app.game.seed import seed
from tools.migrar_sqlite import PLAYER_TABLES, copy_players, open_snapshot


def _count(eng, table):
    with eng.connect() as conn:
        return conn.scalar(select(func.count()).select_from(table))


@pytest.mark.skipif(engine.dialect.name != "sqlite", reason="a origem da cópia é o SQLite dos testes")
def test_copies_players_to_an_empty_database(tmp_path, player):
    assert player.post("/api/gacha/pull", {"banner": "limited", "count": 10}).status_code == 200
    source = open_snapshot(Path(engine.url.database), tmp_path)

    target = create_engine(f"sqlite:///{tmp_path / 'destino.db'}")
    Base.metadata.create_all(target)
    with Session(target) as db:
        seed(db)
        db.commit()

    copied = copy_players(source, target)
    for table in PLAYER_TABLES:
        assert copied[table.name] == _count(source, table) == _count(target, table)

    with Session(source) as src, Session(target) as dst:
        original = src.scalar(select(m.User).where(m.User.nickname == player.nickname))
        copy = dst.scalar(select(m.User).where(m.User.nickname == player.nickname))
        assert copy.password_hash == original.password_hash  # a mesma senha continua valendo
        assert copy.total_pulls == original.total_pulls == 10
        assert dst.get(m.ServerStat, "total_pulls").value == src.get(m.ServerStat, "total_pulls").value

    with pytest.raises(RuntimeError, match="já tem jogadores"):
        copy_players(source, target)  # nunca duplica: o destino precisa estar vazio
    source.dispose()
    target.dispose()
