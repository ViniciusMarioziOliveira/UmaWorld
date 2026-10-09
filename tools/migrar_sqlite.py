"""Copia os jogadores de um banco SQLite (umaworld.db) para o banco do DATABASE_URL.

Uso:
    python -m tools.migrar_sqlite                  # copia o umaworld.db
    python -m tools.migrar_sqlite caminho/outro.db

- O arquivo SQLite não é alterado: a leitura é feita numa cópia temporária.
- Vão juntos as contas (com as mesmas senhas), as personagens, o inventário, o pity,
  o histórico de pulls, a Fazenda, as missões, as compras, o Chat Global e os contadores.
- O catálogo (personagens, itens, missões, loja e avisos) não é copiado: o destino
  recebe o catálogo atual, como em qualquer inicialização do servidor.
- O destino precisa estar sem jogadores. A cópia é feita numa transação só: ou vai
  tudo, ou nada.
"""
import argparse
import sqlite3
import sys
import tempfile
from contextlib import closing
from pathlib import Path

from sqlalchemy import create_engine, func, insert, select, text, update
from sqlalchemy.engine import Engine

from app import models as m
from app.config import BASE_DIR
from app.database import engine
from app.migrate import prepare_database, upgrade_schema

# Na ordem das chaves estrangeiras: quem é referenciado vem antes.
PLAYER_TABLES = [model.__table__ for model in (
    m.User, m.UserCharacter, m.UserCharacterSkill, m.InventoryItem, m.PityState,
    m.Pull, m.Farm, m.UserMission, m.Purchase, m.FeedEvent,
)]
CHUNK = 500


def open_snapshot(path: Path, workdir: Path) -> Engine:
    """Cópia consistente do SQLite (inclui o que ainda está no WAL), atualizada para a versão atual."""
    snapshot = workdir / "origem.db"
    with closing(sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)) as src, \
            closing(sqlite3.connect(snapshot)) as dst:
        src.backup(dst)
    source = create_engine(f"sqlite:///{snapshot}")
    upgrade_schema(source)
    return source


def copy_players(source: Engine, target: Engine) -> dict[str, int]:
    """Copia jogadores, progresso, feed e contadores de `source` para `target` (já com o catálogo)."""
    copied = {}
    with source.connect() as src, target.begin() as dst:
        if dst.scalar(select(func.count()).select_from(m.User.__table__)):
            raise RuntimeError("O banco de destino já tem jogadores. Para copiar de novo, zere o destino "
                               "antes (veja 'Zerar o jogo' no GUIA_BANCO_DE_DADOS.md).")
        for table in PLAYER_TABLES:
            rows = [dict(row) for row in src.execute(select(table)).mappings()]
            for start in range(0, len(rows), CHUNK):
                dst.execute(insert(table), rows[start:start + CHUNK])
            copied[table.name] = len(rows)

        stats = m.ServerStat.__table__
        for key, value in src.execute(select(stats.c.key, stats.c.value)).all():
            if not dst.execute(update(stats).where(stats.c.key == key).values(value=value)).rowcount:
                dst.execute(insert(stats).values(key=key, value=value))

        if dst.dialect.name == "postgresql":
            # Os ids vieram prontos: os contadores automáticos precisam continuar depois deles.
            for table in PLAYER_TABLES:
                if "id" in table.c:
                    dst.execute(text(f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), "
                                     f"COALESCE((SELECT MAX(id) FROM {table.name}), 0) + 1, false)"))
    return copied


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("sqlite", nargs="?", type=Path, default=BASE_DIR / "umaworld.db",
                        help="arquivo SQLite de origem (padrão: umaworld.db)")
    args = parser.parse_args()
    if not args.sqlite.exists():
        print(f"Arquivo não encontrado: {args.sqlite}")
        return 1
    if engine.dialect.name == "sqlite":
        print("O DATABASE_URL não aponta para um PostgreSQL. Configure o .env antes "
              "(veja GUIA_BANCO_DE_DADOS.md).")
        return 1

    print(f"Origem:  {args.sqlite}")
    print(f"Destino: {engine.url.render_as_string(hide_password=True)}")
    prepare_database()
    with tempfile.TemporaryDirectory() as workdir:
        source = open_snapshot(args.sqlite, Path(workdir))
        try:
            copied = copy_players(source, engine)
        except RuntimeError as exc:
            print(exc)
            return 1
        finally:
            source.dispose()

    for name, count in copied.items():
        print(f"  {name:<22} {count}")
    print("Pronto. Entre no jogo com as mesmas contas e senhas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
