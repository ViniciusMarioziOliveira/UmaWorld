import pytest
from sqlalchemy import create_engine, func, inspect, select, text
from sqlalchemy.orm import Session

from app import models as m
from app.database import Base, engine
from app.game.seed import seed
from tools.backup_banco import backup
from tools.migrar_sqlite import copy_players, open_snapshot


def test_backup_of_a_database_from_before_the_exchange(tmp_path):
    """Banco que o servidor novo ainda não atualizou: o backup sai igual a ele (sem as colunas
    novas), e quem o restaura recebe a mesma atualização: os pulls antigos contam para a troca."""
    old = create_engine(f"sqlite:///{tmp_path / 'antigo.db'}")
    Base.metadata.create_all(old)
    with Session(old) as db:
        db.add(m.User(id=1, nickname="Velha", nickname_key="velha", password_hash="x", total_pulls=260))
        db.add(m.PityState(user_id=1, banner_type="limited", pity5=10, pity4=2, guaranteed=False, total=260))
        db.commit()
    with old.begin() as conn:
        conn.execute(text("ALTER TABLE pity DROP COLUMN spark"))
        conn.execute(text("ALTER TABLE pity DROP COLUMN exchanges"))

    path = tmp_path / "backup.db"
    assert backup(old, path)["pity"] == 1
    copy_engine = create_engine(f"sqlite:///{path}")
    assert {c["name"] for c in inspect(copy_engine).get_columns("pity")} == {
        "user_id", "banner_type", "pity5", "pity4", "guaranteed", "total"}
    copy_engine.dispose()

    source = open_snapshot(path, tmp_path)
    target = create_engine(f"sqlite:///{tmp_path / 'novo.db'}")
    Base.metadata.create_all(target)
    copy_players(source, target)
    with target.connect() as conn:
        assert conn.execute(text("SELECT spark, exchanges FROM pity")).one() == (200, 0)
    for e in (old, source, target):
        e.dispose()


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
