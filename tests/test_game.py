from datetime import timedelta

from app import models as m
from app.game import gacha, training
from app.game.clock import utcnow

from .conftest import StubRng


def test_register_and_login(client, player):
    assert player.me["coins"] == 50_000
    assert player.me["tickets"] == 10

    dup = client.post("/api/auth/register", json={"nickname": player.nickname.upper(), "password": "outra123"})
    assert dup.status_code == 409

    bad = client.post("/api/auth/login", json={"nickname": player.nickname, "password": "errada"})
    assert bad.status_code == 401

    ok = client.post("/api/auth/login", json={"nickname": player.nickname.upper(), "password": "segredo123"})
    assert ok.status_code == 200


def test_login_limit_counts_the_ip_from_the_proxy(client, player, monkeypatch):
    # Como no Render: o X-Forwarded-For termina num endereço interno que muda a cada requisição.
    from app.routers import auth

    monkeypatch.setattr(auth, "CLIENT_IP_HEADER", "cf-connecting-ip")
    wrong = {"nickname": player.nickname, "password": "errada"}

    def attempt(ip, hop):
        headers = {"CF-Connecting-IP": ip, "X-Forwarded-For": f"9.9.9.9, {ip}, 10.0.0.{hop}"}
        return client.post("/api/auth/login", json=wrong, headers=headers).status_code

    assert [attempt("203.0.113.7", hop) for hop in range(auth.login_limiter.limit)] == [401] * auth.login_limiter.limit
    assert attempt("203.0.113.7", 99) == 429
    assert attempt("198.51.100.2", 1) == 401  # outra pessoa não é bloqueada

    me = player.get("/api/me").json()
    assert me["me"]["nickname"] == player.nickname
    assert me["badges"]["missions"] >= 1  # login diário

    assert client.get("/api/me").status_code == 401


def test_invalid_nickname_message(client):
    res = client.post("/api/auth/register", json={"nickname": "a b", "password": "segredo123"})
    assert res.status_code == 422
    assert "apelido" in res.json()["detail"]


def test_starter_character_and_training(player, monkeypatch):
    roster = player.get("/api/characters").json()["characters"]
    assert len(roster) == 1
    uc_id = roster[0]["id"]

    res = player.post(f"/api/characters/{uc_id}/level", {"manuals": {"manual_basico": 3}})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["character"]["level"] > 1
    assert data["materials"]["items"]["manual_basico"]["qty"] == 17

    res = player.post(f"/api/characters/{uc_id}/ascend")
    assert res.status_code == 400

    monkeypatch.setattr(training, "rng", StubRng(0.99))
    res = player.post(f"/api/characters/{uc_id}/attribute", {"stat": "speed", "times": 3})
    assert res.status_code == 200, res.text
    assert res.json()["character"]["stats"]["speed"]["bonus"] == 9  # 3 treinos x ganho mínimo 3

    skill = data["character"]["skills"][0]["id"]
    res = player.post(f"/api/characters/{uc_id}/skill", {"skill_id": skill})
    assert res.status_code == 200
    assert res.json()["character"]["skills"][0]["level"] == 2


def test_ascension_flow(player):
    roster = player.get("/api/characters").json()["characters"]
    uc_id = roster[0]["id"]
    before = roster[0]["power"]

    def fn(db, user):
        uc = db.get(m.UserCharacter, uc_id)
        uc.level = 20
    player.edit(fn)

    res = player.post(f"/api/characters/{uc_id}/ascend")
    assert res.status_code == 200, res.text
    char = res.json()["character"]
    assert char["ascension"] == 1 and char["level_cap"] == 40
    assert char["power"] > before


def test_equipment(player):
    uc_id = player.get("/api/characters").json()["characters"][0]["id"]
    assert player.post(f"/api/characters/{uc_id}/equip", {"item_id": "eq_sapatilha"}).status_code == 400
    player.post("/api/shop/c_eq_sapatilha/buy", {"quantity": 1})
    res = player.post(f"/api/characters/{uc_id}/equip", {"item_id": "eq_sapatilha"})
    assert res.status_code == 200, res.text
    assert res.json()["character"]["stats"]["speed"]["equip"] == 60
    res = player.post(f"/api/characters/{uc_id}/equip", {"item_id": None})
    assert res.json()["character"]["equipment"] is None
    inv = player.get("/api/inventory").json()
    assert any(i["id"] == "eq_sapatilha" and i["qty"] == 1 for i in inv["items"])


def test_afk_collect(player):
    res = player.post("/api/afk/collect")
    assert res.status_code == 400  # acabou de criar a conta

    def fn(db, user):
        farm = db.get(m.Farm, user.id)
        farm.last_collected_at = utcnow() - timedelta(hours=30)  # passa do limite de 8h
    player.edit(fn)

    view = player.get("/api/afk").json()
    assert view["full"] is True
    assert view["effective_hours"] == 8

    coins_before = player.get("/api/me").json()["me"]["coins"]
    res = player.post("/api/afk/collect")
    assert res.status_code == 200, res.text
    collected = {r["kind"] if r["kind"] != "item" else r["id"]: r["qty"] for r in res.json()["collected"]}
    assert collected["coins"] == 1200 * 8
    assert res.json()["me"]["coins"] == coins_before + 1200 * 8
    assert player.post("/api/afk/collect").status_code == 400


def test_afk_helpers_and_upgrade(player):
    uc_id = player.get("/api/characters").json()["characters"][0]["id"]
    res = player.post("/api/afk/helpers", {"slots": [uc_id, None, None]})
    assert res.status_code == 200, res.text
    assert res.json()["farm"]["efficiency"] > 1
    assert player.post("/api/afk/helpers", {"slots": [uc_id, uc_id, None]}).status_code == 400

    res = player.post("/api/afk/upgrade", {"kind": "farm"})
    assert res.status_code == 200
    assert res.json()["farm"]["level"] == 2


def test_missions_claim(player, monkeypatch):
    monkeypatch.setattr(gacha, "rng", StubRng(0.99))
    player.post("/api/gacha/pull", {"banner": "standard", "count": 1})
    missions = player.get("/api/missions").json()
    daily = {x["id"]: x for x in missions["daily"]}
    assert daily["d_pull"]["claimable"] is True
    assert daily["d_login"]["claimable"] is True

    carats = player.get("/api/me").json()["me"]["carats"]
    res = player.post("/api/missions/d_pull/claim")
    assert res.status_code == 200
    assert res.json()["me"]["carats"] == carats + 50
    assert player.post("/api/missions/d_pull/claim").status_code == 400

    res = player.post("/api/missions/claim-all", {"category": "daily"})
    assert res.status_code == 200
    assert player.post("/api/missions/claim-all", {"category": "daily"}).status_code == 400


def test_shop_limits_and_cosmetics(player):
    assert player.post("/api/shop/c_manual_basico/buy", {"quantity": 5}).status_code == 200
    res = player.post("/api/shop/c_manual_basico/buy", {"quantity": 1})
    assert res.status_code == 400 and "Limite" in res.json()["detail"]

    def rich(db, user):
        user.coins = 1_000_000
    player.edit(rich)
    assert player.post("/api/shop/x_titulo_turfista/buy").status_code == 200
    assert player.post("/api/shop/x_titulo_turfista/buy").status_code == 400

    res = player.put("/api/profile", {"title_item_id": "titulo_turfista"})
    assert res.status_code == 200
    assert res.json()["me"]["title"]["id"] == "titulo_turfista"
    assert player.put("/api/profile", {"frame_item_id": "moldura_dourada"}).status_code == 400


def test_profile_and_ranking(player):
    uc_id = player.get("/api/characters").json()["characters"][0]["id"]
    assert player.put("/api/profile", {"favorites": [uc_id]}).status_code == 200
    prof = player.get(f"/api/profile/{player.nickname}").json()
    assert prof["is_me"] and prof["favorites"][0]["id"] == uc_id
    assert prof["stats"]["collection"] == 1
    assert len(prof["collection"]) == prof["stats"]["collection_total"]

    for cat in ("level", "power", "pulls", "collection", "five_stars"):
        res = player.get(f"/api/ranking/{cat}")
        assert res.status_code == 200, (cat, res.text)
    power = player.get("/api/ranking/power").json()
    assert power["mine"]["position"] >= 1
    assert player.get("/api/ranking/xyz").status_code == 404


def test_hub_and_public_feed(client, player):
    hub = player.get("/api/hub").json()
    assert hub["stats"]["players"] >= 1
    assert len(hub["events"]) == 4
    duo = next(e for e in hub["events"] if e["link"] == "gacha/duo")
    assert [c["id"] for c in duo["characters"]] == ["forever_young", "marche_lorraine"]
    feed = client.get("/api/feed").json()["events"]
    assert any(e["kind"] == "new_player" for e in feed)


def test_frontend_files_are_checked_for_updates(client):
    """Sem isso, depois de uma atualização o navegador continua rodando o JavaScript antigo."""
    script = client.get("/js/main.js")
    assert script.status_code == 200
    assert script.headers["cache-control"] == "no-cache"
    again = client.get("/js/main.js", headers={"If-None-Match": script.headers["etag"]})
    assert again.status_code == 304  # nada mudou: o navegador reaproveita a cópia sem baixar de novo
    assert client.get("/").headers["cache-control"] == "no-cache"
    art = client.get("/img/umas/haru_urara/icon.webp")
    assert art.status_code == 200
    assert art.headers["cache-control"] == "public, max-age=86400"


def test_rank_up_feed(player):
    # Nível 9 precisa de 920 XP; 10 pulls dão +100 e passam para o 10 (Rank Prata).
    def fn(db, user):
        user.level = 9
        user.xp = 900
    player.edit(fn)
    player.post("/api/gacha/pull", {"banner": "standard", "count": 10})
    me = player.get("/api/me").json()["me"]
    assert me["level"] == 10 and me["rank"]["name"] == "Prata"
    feed = player.get("/api/feed").json()["events"]
    assert any(e["kind"] == "rank_up" and e["nickname"] == player.nickname for e in feed)


def test_attribute_training_stops_when_out_of_carrots(player, monkeypatch):
    monkeypatch.setattr(training, "rng", StubRng(0.99))
    uc_id = player.get("/api/characters").json()["characters"][0]["id"]

    def two_carrots(db, user):
        db.get(m.InventoryItem, (user.id, "cenoura")).qty = 2
    player.edit(two_carrots)

    res = player.post(f"/api/characters/{uc_id}/attribute", {"stat": "wit", "times": 5})
    assert res.status_code == 200, res.text
    assert res.json()["result"]["sessions"] == 2  # faz as que dá, sem desfazer tudo

    res = player.post(f"/api/characters/{uc_id}/attribute", {"stat": "wit", "times": 1})
    assert res.status_code == 400 and "Cenoura" in res.json()["detail"]
