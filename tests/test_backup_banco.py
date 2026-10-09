import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app import models as m
from app.database import Base, engine
from app.game.seed import seed
from tools.backup_banco import backup
from tools.migrar_sqlite import copy_players, open_snapshot


def test_backup_copies_every_table_and_goes_back_to_a_new_database(tmp_path, player):
    assert player.post("/api/gacha/pull", {"banner": "limited", "count": 10}).status_code == 200
    path = tmp_path / "backup.db"

    counts = backup(engine, path)  # só devolve depois de conferir o arquivo com o banco
    with engine.connect() as conn:
        for table in Base.metadata.sorted_tables:
            assert counts[table.name] == conn.scalar(select(func.count()).select_from(table))
    assert not path.with_name("backup.db.parcial").exists()

    with pytest.raises(FileExistsError):
        backup(engine, path)  # nunca sobrescreve um backup

    # O backup volta para um banco novo pela mesma ferramenta que leva o SQLite ao Supabase.
    source = open_snapshot(path, tmp_path)
    target = create_engine(f"sqlite:///{tmp_path / 'destino.db'}")
    Base.metadata.create_all(target)
    with Session(target) as db:
        seed(db)
        db.commit()
    copy_players(source, target)
    with Session(target) as db:
        copy = db.scalar(select(m.User).where(m.User.nickname == player.nickname))
        assert copy.total_pulls == 10
    source.dispose()
    target.dispose()
