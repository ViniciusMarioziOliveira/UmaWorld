"""Quantas leituras cada ação faz no banco.

Em produção o servidor fica longe do banco (Render na Virgínia, Supabase em São Paulo): cada
ida ao banco custa ~120 ms. Uma ação que lê "uma linha por item" (uma consulta por pull, por
missão, por item do inventário) fica lenta sem ninguém perceber nos testes, que rodam num
SQLite local. Estes testes travam o número de leituras.
"""
from contextlib import contextmanager

from sqlalchemy import event

from app.database import engine
from app.game import gacha

from .conftest import StubRng
from .test_gacha import give_carats


@contextmanager
def reads():
    count = [0]

    def on_execute(_conn, _cursor, statement, *_args):
        if statement.lstrip().upper().startswith("SELECT"):
            count[0] += 1

    event.listen(engine, "before_cursor_execute", on_execute)
    try:
        yield count
    finally:
        event.remove(engine, "before_cursor_execute", on_execute)


def test_pull_reads_do_not_grow_with_count(player, monkeypatch):
    monkeypatch.setattr(gacha, "rng", StubRng(0.99))
    give_carats(player)
    with reads() as one:
        assert player.post("/api/gacha/pull", {"banner": "standard", "count": 1}).status_code == 200
    with reads() as ten:
        assert player.post("/api/gacha/pull", {"banner": "standard", "count": 10}).status_code == 200
    # +2: o 10º pull traz uma 4★ nova, e montar uma personagem nova lê o catálogo uma vez.
    assert ten[0] <= one[0] + 2, (one[0], ten[0])
    assert one[0] <= 8, one[0]


def test_screens_read_little(player):
    counts = {}
    for url in ("/api/me", "/api/hub", "/api/gacha", "/api/missions", "/api/shop", "/api/characters",
                f"/api/profile/{player.nickname}", "/api/inventory"):
        with reads() as n:
            assert player.get(url).status_code == 200
        counts[url] = n[0]
    assert all(n <= 8 for n in counts.values()), counts
