from datetime import date, timedelta

from app import models as m
from app.game import catalog, gacha
from app.game.clock import day_start_utc
from app.game.registry import chars_by

from .conftest import FIRST_DUO_RUN as FIRST_RUN, StubRng, at


def set_spark(player, banner_type, spark):
    def fn(db, user):
        gacha.get_pity(db, user.id, banner_type).spark = spark
    player.edit(fn)


def give_carats(player, amount=100_000):
    def fn(db, user):
        user.carats = amount
    player.edit(fn)


def set_wallet(player, tickets, carats):
    def fn(db, user):
        user.carats = carats
        db.get(m.InventoryItem, (user.id, "ticket")).qty = tickets
    player.edit(fn)


def set_limited_pity(player, pity5):
    def fn(db, user):
        gacha.get_pity(db, user.id, "limited").pity5 = pity5
    player.edit(fn)


def banners_by_key(player):
    return {b["key"]: b for b in player.get("/api/gacha").json()["banners"]}


class PickLast(StubRng):
    """Como o StubRng, mas o sorteio entre opções pega a última."""

    def choice(self, seq):
        return seq[-1]


def test_chance_curve():
    assert gacha.chance_5(1) == gacha.RATE_5
    assert gacha.chance_5(73) == gacha.RATE_5
    assert gacha.chance_5(74) > gacha.RATE_5
    assert gacha.chance_5(90) == 1.0


def test_hard_pity_and_50_50(player, monkeypatch):
    """Com o sorteio sempre "azarado", o 5⭐ só vem no 90 e o 4⭐ a cada 10."""
    monkeypatch.setattr(gacha, "rng", StubRng(0.99))
    give_carats(player)
    results = []
    for _ in range(9):
        res = player.post("/api/gacha/pull", {"banner": "limited", "count": 10})
        assert res.status_code == 200, res.text
        results += res.json()["results"]

    # 10 tickets iniciais foram usados primeiro, depois carats.
    assert [r["rarity"] for r in results[:10]] == [3] * 9 + [4]
    assert all(r["rarity"] < 5 for r in results[:89])
    last = results[89]
    assert last["rarity"] == 5 and last["pity"] == 90
    # 0.99 >= 0.5: perdeu o 50/50 -> veio uma 5⭐ do pool padrão e o próximo é garantido.
    assert last["featured"] is False
    assert last["character"]["pool"] == "standard"

    banners = player.get("/api/gacha").json()["banners"]
    limited = next(b for b in banners if b["type"] == "limited")
    assert limited["pity"]["guaranteed"] is True
    assert limited["pity"]["pity5"] == 0

    # Próxima 5⭐ (forçada) tem que ser a destacada.
    monkeypatch.setattr(gacha, "rng", StubRng(0.0))
    res = player.post("/api/gacha/pull", {"banner": "limited", "count": 1}).json()
    assert res["results"][0]["featured"] is True
    assert res["results"][0]["character"]["id"] == limited["featured5"][0]["id"]


def test_duo_banner_lineup(duo_open):
    banners = gacha.current_banners()
    assert list(banners) == ["limited", "duo", "standard"]
    duo = banners["duo"]
    assert duo.type == "limited"
    # 21 dias: abre à 00:00 do primeiro dia e fecha à 00:00 do 22º (horário de Brasília = UTC-3).
    assert (duo.starts_at, duo.ends_at) == ("2026-10-08T03:00:00Z", "2026-10-29T03:00:00Z")
    assert duo.featured5 == ["forever_young", "marche_lorraine"]
    # As duas não entram na rotação semanal, e as 4★ em destaque são outras.
    assert banners["limited"].featured5[0] not in duo.featured5
    assert not set(duo.featured4) & set(banners["limited"].featured4)
    pool5 = {c["id"] for c in gacha.banner_view(duo, None)["pool"]["five"]}
    assert set(duo.featured5) <= pool5
    assert not set(duo.featured5) & {c["id"] for c in chars_by(5, "standard")}


def test_duo_banner_closes_after_21_days_and_can_rerun(player, monkeypatch):
    opens = day_start_utc(FIRST_RUN[0])
    closes = opens + timedelta(days=21)
    monkeypatch.setattr(gacha, "utcnow", at(closes - timedelta(seconds=1)))
    assert "duo" in gacha.current_banners()
    assert catalog.last_day(FIRST_RUN) == date(2026, 10, 28)

    monkeypatch.setattr(gacha, "utcnow", at(closes))
    assert list(gacha.current_banners()) == ["limited", "standard"]
    assert [b["key"] for b in player.get("/api/gacha").json()["banners"]] == ["limited", "standard"]
    assert all(e["link"] != "gacha/duo" for e in player.get("/api/hub").json()["events"])
    res = player.post("/api/gacha/pull", {"banner": "duo", "count": 1})
    assert res.status_code == 400 and "não está aberto" in res.json()["detail"]
    monkeypatch.setattr(gacha, "utcnow", at(opens - timedelta(seconds=1)))
    assert "duo" not in gacha.current_banners()

    # Rerun: outro período na lista, e o mesmo banner volta (com o fim do novo período).
    monkeypatch.setattr(catalog, "DUO_BANNER_RUNS", [FIRST_RUN, (date(2027, 1, 10), 14)])
    monkeypatch.setattr(gacha, "utcnow", at(day_start_utc(date(2027, 1, 12))))
    assert gacha.current_banners()["duo"].ends_at == "2027-01-24T03:00:00Z"


def test_pulls_fill_the_exchange_count(player, duo_open):
    give_carats(player)
    player.post("/api/gacha/pull", {"banner": "standard", "count": 10})
    res = player.post("/api/gacha/pull", {"banner": "limited", "count": 3}).json()
    assert res["spark"] == {"count": 3, "cost": 200, "ready": False, "once": False}
    player.post("/api/gacha/pull", {"banner": "duo", "count": 2})
    banners = banners_by_key(player)
    assert banners["limited"]["spark"]["count"] == banners["duo"]["spark"]["count"] == 5  # os limitados dividem
    assert banners["standard"]["spark"] == {"count": 10, "cost": 200, "ready": False, "once": True}


def test_limited_exchange_as_many_times_as_200_pulls_allow(client, player, duo_open):
    set_spark(player, "limited", 450)
    duo = banners_by_key(player)["duo"]
    assert duo["spark"]["ready"] is True and duo["spark"]["owned"] == {}  # nenhuma 5★ ainda

    # Só as destacadas do banner escolhido entram na troca.
    holofote_star = banners_by_key(player)["limited"]["featured5"][0]["id"]
    assert player.post("/api/gacha/exchange", {"banner": "duo", "character": holofote_star}).status_code == 400
    assert player.post("/api/gacha/exchange", {"banner": "duo", "character": "special_week"}).status_code == 400

    first = player.post("/api/gacha/exchange", {"banner": "duo", "character": "forever_young"}).json()
    assert first["result"]["character"]["id"] == "forever_young" and first["result"]["outcome"] == "new"
    assert first["spark"]["count"] == 250 and first["spark"]["owned"] == {"forever_young": 0}
    again = player.post("/api/gacha/exchange", {"banner": "duo", "character": "forever_young"}).json()
    assert again["result"]["outcome"] == "awakening" and again["result"]["awakening"] == 1
    assert again["spark"] == {"count": 50, "cost": 200, "ready": False, "once": False}

    res = player.post("/api/gacha/exchange", {"banner": "limited", "character": holofote_star})
    assert res.status_code == 400 and "Faltam 150 pulls" in res.json()["detail"]
    # A troca não é um pull: não entra no histórico nem no contador de 5★ dos pulls.
    assert player.get("/api/gacha/history").json()["total"] == 0
    assert player.get("/api/me").json()["me"]["five_star_count"] == 0
    feed = client.get("/api/feed").json()["events"]
    assert any(e["kind"] == "exchange" and e["nickname"] == player.nickname for e in feed)


def test_standard_exchange_only_once_per_account(player):
    set_spark(player, "standard", 200)
    std = banners_by_key(player)["standard"]
    assert std["spark"]["ready"] and std["spark"]["once"]
    res = player.post("/api/gacha/exchange", {"banner": "standard", "character": "special_week"})
    assert res.status_code == 200, res.text
    assert res.json()["result"]["character"]["id"] == "special_week"
    assert res.json()["spark"] is None  # o seletor some
    assert banners_by_key(player)["standard"]["spark"] is None

    set_spark(player, "standard", 400)
    res = player.post("/api/gacha/exchange", {"banner": "standard", "character": "gold_ship"})
    assert res.status_code == 400 and "já foi usada" in res.json()["detail"]
    assert banners_by_key(player)["standard"]["spark"] is None


def test_duo_banner_50_50_and_guarantee(player, monkeypatch, duo_open):
    """Perdeu o 50/50: a garantia entrega uma das duas destacadas, sorteada entre elas."""
    give_carats(player)
    monkeypatch.setattr(gacha, "rng", StubRng(0.99))  # 5★ só no hard pity, e perde o 50/50
    set_limited_pity(player, 89)
    lost = player.post("/api/gacha/pull", {"banner": "duo", "count": 1}).json()["results"][0]
    assert lost["rarity"] == 5 and lost["featured"] is False
    assert lost["character"]["pool"] == "standard"
    assert banners_by_key(player)["duo"]["pity"]["guaranteed"] is True

    monkeypatch.setattr(gacha, "rng", PickLast(0.99))
    set_limited_pity(player, 89)
    won = player.post("/api/gacha/pull", {"banner": "duo", "count": 1}).json()["results"][0]
    assert won["featured"] is True and won["character"]["id"] == "marche_lorraine"
    assert banners_by_key(player)["duo"]["pity"]["guaranteed"] is False

    monkeypatch.setattr(gacha, "rng", StubRng(0.0))  # 5★ na hora e ganha o 50/50
    lucky = player.post("/api/gacha/pull", {"banner": "duo", "count": 1}).json()["results"][0]
    assert lucky["featured"] is True and lucky["character"]["id"] == "forever_young"

    history = player.get("/api/gacha/history", params={"rarity": 5}).json()["items"]
    assert [i["banner_label"] for i in history] == ["Dupla Estelar"] * 3


def test_limited_banners_share_pity_and_guarantee(player, monkeypatch, duo_open):
    give_carats(player)
    monkeypatch.setattr(gacha, "rng", StubRng(0.99))
    assert player.post("/api/gacha/pull", {"banner": "limited", "count": 3}).status_code == 200
    assert banners_by_key(player)["duo"]["pity"]["pity5"] == 3
    assert player.post("/api/gacha/pull", {"banner": "duo", "count": 2}).status_code == 200
    banners = banners_by_key(player)
    assert banners["limited"]["pity"]["pity5"] == 5
    assert banners["standard"]["pity"]["pity5"] == 0

    # A garantia ganha no Holofote vale na Dupla Estelar.
    set_limited_pity(player, 89)
    lost = player.post("/api/gacha/pull", {"banner": "limited", "count": 1}).json()["results"][0]
    assert lost["featured"] is False
    set_limited_pity(player, 89)
    won = player.post("/api/gacha/pull", {"banner": "duo", "count": 1}).json()["results"][0]
    assert won["featured"] is True and won["character"]["id"] in ("forever_young", "marche_lorraine")


def test_outdated_page_is_asked_to_reload(player):
    """Uma tela antiga manda "banner_type", que não diz qual dos banners limitados ela mostra.
    Em vez de puxar no banner errado, o servidor pede para recarregar e não cobra nada."""
    res = player.post("/api/gacha/pull", {"banner_type": "limited", "count": 1})
    assert res.status_code == 400
    assert "Recarregue" in res.json()["detail"]
    assert player.get("/api/gacha/history").json()["total"] == 0
    assert player.post("/api/gacha/pull", {"banner": "outro", "count": 1}).status_code == 422


def test_pull_requires_currency(player):
    def fn(db, user):
        user.carats = 0
    player.edit(fn)
    # Ainda tem 10 tickets: 10x funciona, o próximo 1x não.
    assert player.post("/api/gacha/pull", {"banner": "standard", "count": 10}).status_code == 200
    res = player.post("/api/gacha/pull", {"banner": "standard", "count": 1})
    assert res.status_code == 400
    assert "ticket" in res.json()["detail"]


def test_ten_pull_mixes_tickets_and_carats(player):
    """6 tickets + 4 pulls em carats fecham um 10x."""
    set_wallet(player, tickets=6, carats=1_000)
    res = player.post("/api/gacha/pull", {"banner": "standard", "count": 10})
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["results"]) == 10
    assert body["paid"] == {"tickets": 6, "carats": 4 * gacha.PULL_COST_CARATS}
    assert body["me"]["tickets"] == 0
    assert body["me"]["carats"] == 1_000 - 4 * gacha.PULL_COST_CARATS


def test_pull_all_tickets_at_once(player):
    """Com 6 tickets dá para fazer um 6x sem gastar carats."""
    set_wallet(player, tickets=6, carats=0)
    res = player.post("/api/gacha/pull", {"banner": "limited", "count": 6})
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["results"]) == 6
    assert body["paid"] == {"tickets": 6, "carats": 0}
    assert body["me"]["tickets"] == 0
    assert player.get("/api/gacha/history").json()["total"] == 6


def test_mixed_payment_short_on_carats_spends_nothing(player):
    set_wallet(player, tickets=6, carats=4 * gacha.PULL_COST_CARATS - 1)
    res = player.post("/api/gacha/pull", {"banner": "standard", "count": 10})
    assert res.status_code == 400
    assert "6 ticket(s)" in res.json()["detail"]
    me = player.get("/api/me").json()["me"]
    assert me["tickets"] == 6 and me["carats"] == 4 * gacha.PULL_COST_CARATS - 1
    assert player.get("/api/gacha/history").json()["total"] == 0


def test_pull_count_limits(player):
    for count in (0, 11):
        res = player.post("/api/gacha/pull", {"banner": "standard", "count": count})
        assert res.status_code == 422
        assert "1 a 10" in res.json()["detail"]


def test_duplicates_awaken_then_fragments(player, monkeypatch):
    monkeypatch.setattr(gacha, "rng", StubRng(0.99))  # sempre a 1ª 3⭐ da lista
    give_carats(player)
    first3 = chars_by(3)[0]["id"]
    outcomes = []
    for _ in range(8):
        res = player.post("/api/gacha/pull", {"banner": "standard", "count": 1}).json()
        r = res["results"][0]
        if r["character"]["id"] == first3:
            outcomes.append(r["outcome"])
    # Haru Urara é a personagem inicial, então já começa como cópia.
    assert outcomes[:5] == ["awakening"] * 5
    assert outcomes[5:] == ["fragments"] * (len(outcomes) - 5)


def test_feed_broadcast_over_websocket(client, player, monkeypatch):
    monkeypatch.setattr(gacha, "rng", StubRng(0.0))  # 5⭐ em todo pull
    with client.websocket_connect(f"/ws?token={player.token}") as ws:
        hello = ws.receive_json()
        while hello["type"] != "hello":
            hello = ws.receive_json()
        assert any(p["nickname"] == player.nickname for p in hello["online"])

        res = player.post("/api/gacha/pull", {"banner": "limited", "count": 1})
        assert res.status_code == 200

        for _ in range(20):
            msg = ws.receive_json()
            if msg["type"] == "feed" and msg["event"]["kind"] == "five_star":
                break
        else:
            raise AssertionError("evento 5⭐ não chegou pelo WebSocket")
        assert msg["event"]["nickname"] == player.nickname
        assert "[5★" in msg["event"]["message"] and "com 1 pity" in msg["event"]["message"]


def test_history_pagination(player):
    player.post("/api/gacha/pull", {"banner": "standard", "count": 10})
    hist = player.get("/api/gacha/history").json()
    assert hist["total"] == 10
    assert len(hist["items"]) == 10
    only4 = player.get("/api/gacha/history", params={"rarity": 4}).json()
    assert all(i["rarity"] == 4 for i in only4["items"])
