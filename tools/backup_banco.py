"""Copia o banco do DATABASE_URL inteiro para um arquivo SQLite: um backup local.

Uso:
    python -m tools.backup_banco                    # cria backups/umaworld-AAAAMMDD-HHMMSS.db
    python -m tools.backup_banco caminho/copia.db

- Vão as 18 tabelas: o catálogo, os jogadores com todo o progresso, o Chat Global e os
  contadores. As senhas continuam valendo, porque o hash vai do jeito que está no banco.
- O banco não é alterado. A leitura é feita numa transação só, somente leitura: mesmo com
  o jogo rodando, o arquivo é uma foto do banco num instante.
- No fim, o arquivo é lido de volta e comparado com o banco, tabela por tabela.
- Nunca sobrescreve: se o arquivo já existir, não faz nada.
- Para levar o backup a um PostgreSQL vazio (por exemplo, um projeto novo no Supabase):
      python -m tools.migrar_sqlite backups/umaworld-AAAAMMDD-HHMMSS.db
"""
import argparse
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, insert, select
from sqlalchemy.engine import Connection, Engine

from app import models  # noqa: F401  (registra as tabelas no metadata)
from app.config import BASE_DIR
from app.database import Base, engine

BACKUP_DIR = BASE_DIR / "backups"
CHUNK = 500


def read_tables(conn: Connection) -> dict[str, dict[tuple, dict]]:
    """Todas as linhas de todas as tabelas, indexadas pela chave primária."""
    data = {}
    for table in Base.metadata.sorted_tables:
        pk = [column.name for column in table.primary_key]
        data[table.name] = {tuple(row[name] for name in pk): dict(row)
                            for row in conn.execute(select(table)).mappings()}
    return data


def backup(source: Engine, path: Path) -> dict[str, int]:
    """Grava num SQLite novo, em `path`, todas as tabelas de `source`, e confere a cópia."""
    if path.exists():
        raise FileExistsError(f"O arquivo já existe e não foi alterado: {path}")
    with source.connect() as src:
        if src.dialect.name == "postgresql":
            # Todas as leituras enxergam o banco do mesmo instante, e nada pode ser gravado.
            src.execution_options(isolation_level="REPEATABLE READ", postgresql_readonly=True)
        with src.begin():
            data = read_tables(src)

    # Grava com outro nome e só renomeia depois de conferir: um arquivo pela metade
    # nunca fica com cara de backup.
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_name(path.name + ".parcial")
    partial.unlink(missing_ok=True)
    target = create_engine(f"sqlite:///{partial}")
    try:
        Base.metadata.create_all(target)
        with target.begin() as dst:
            for table in Base.metadata.sorted_tables:
                rows = list(data[table.name].values())
                for start in range(0, len(rows), CHUNK):
                    dst.execute(insert(table), rows[start:start + CHUNK])
        with target.connect() as check:
            copied = read_tables(check)
    finally:
        target.dispose()
    if copied != data:
        raise RuntimeError(f"A cópia não bateu com o banco. O arquivo incompleto ficou em {partial}.")
    partial.rename(path)
    return {name: len(rows) for name, rows in data.items()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("arquivo", nargs="?", type=Path,
                        help="arquivo SQLite a criar (padrão: backups/umaworld-AAAAMMDD-HHMMSS.db)")
    args = parser.parse_args()
    path = args.arquivo or BACKUP_DIR / f"umaworld-{datetime.now():%Y%m%d-%H%M%S}.db"

    print(f"Origem:  {engine.url.render_as_string(hide_password=True)}")
    print(f"Arquivo: {path}")
    try:
        counts = backup(engine, path)
    except (FileExistsError, RuntimeError) as exc:
        print(exc)
        return 1

    for name, count in counts.items():
        print(f"  {name:<22} {count}")
    print("Pronto. O arquivo foi conferido e tem exatamente o que está no banco.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
