"""Quantas leituras cada ação faz no banco.

Em produção o servidor fica longe do banco (Render na Virgínia, Supabase em São Paulo): cada
ida ao banco custa ~120 ms. Uma ação que lê "uma linha por item" (uma consulta por pull, por
missão, por item do inventário) fica lenta sem ninguém perceber nos testes, que rodam num
SQLite local. Estes testes travam o número de leituras.
"""
from contextlib import contextmanager

from sqlalchemy import event

from datetime import timedelta

from app import models as m
from app.database import engine
from app.game import afk, gacha
from app.game.clock import utcnow

from .conftest import StubRng
from .test_gacha import give_carats, set_spark


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
                f"/api/profile/{player.nickname}", "/api/inventory", "/api/afk"):
        with reads() as n:
            assert player.get(url).status_code == 200
        counts[url] = n[0]
    assert all(n <= 8 for n in counts.values()), counts


def test_exchange_reads_little(player):
    set_spark(player, "standard", 200)
    with reads() as screen:  # com a troca pronta, a tela também lê a coleção (nova ou despertar)
        assert player.get("/api/gacha").status_code == 200
    with reads() as n:
        res = player.post("/api/gacha/exchange", {"banner": "standard", "character": "special_week"})
        assert res.status_code == 200, res.text
    assert screen[0] <= 8 and n[0] <= 8, (screen[0], n[0])


def test_farm_collect_reads_do_not_grow_with_hours(player, monkeypatch):
    """O sorteio da visitante rara é feito na memória: 8 horas não leem mais que 1."""
    def wait(hours):
        def fn(db, user):
            db.get(m.Farm, user.id).last_collected_at = utcnow() - timedelta(hours=hours)
        player.edit(fn)

    wait(1)
    with reads() as one:
        assert player.post("/api/afk/collect").status_code == 200
    wait(8)
    with reads() as eight:
        assert player.post("/api/afk/collect").status_code == 200
    assert eight[0] == one[0] and one[0] <= 8, (one[0], eight[0])

    # Com a visitante (0,5% por hora): a coleção e o catálogo são lidos uma vez, para ela entrar no
    # estábulo. Oito visitas na mesma colheita custam o mesmo que uma.
    monkeypatch.setattr(afk, "rng", StubRng(0.0))
    wait(8)
    with reads() as lucky:
        res = player.post("/api/afk/collect")
        assert len(res.json()["rare"]) == 8
    assert lucky[0] <= one[0] + 3, (one[0], lucky[0])
