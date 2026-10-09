"""Corredora do mundo (avatar), ficha oficial e migração de bancos antigos."""
from sqlalchemy import create_engine, inspect, text

from app.game import gacha
from app.migrate import upgrade_schema

from .conftest import StubRng


def test_avatar_defaults_to_starter_and_can_change(player, monkeypatch):
    assert player.me["avatar"]["character"]["id"] == "haru_urara"

    monkeypatch.setattr(gacha, "rng", StubRng(0.0))  # 5★ destacada
    pulled = player.post("/api/gacha/pull", {"banner": "limited", "count": 1}).json()
    new_id = pulled["results"][0]["character"]["id"]
    roster = player.get("/api/characters").json()["characters"]
    uc = next(c for c in roster if c["character"]["id"] == new_id)

    res = player.put("/api/profile", {"avatar_uc_id": uc["id"]})
    assert res.status_code == 200, res.text
    assert res.json()["me"]["avatar"]["character"]["id"] == new_id
    assert player.put("/api/profile", {"avatar_uc_id": 999999}).status_code == 400


def test_presence_includes_avatar(client, player):
    with client.websocket_connect(f"/ws?token={player.token}") as ws:
        msg = ws.receive_json()
        while msg["type"] != "hello":
            msg = ws.receive_json()
        me = next(p for p in msg["online"] if p["nickname"] == player.nickname)
        assert me["avatar"] == "haru_urara"


def test_character_detail_has_official_bio(player):
    uc_id = player.get("/api/characters").json()["characters"][0]["id"]
    data = player.get(f"/api/characters/{uc_id}").json()
    bio = data["bio"]
    assert bio["name_jp"] == "ハルウララ"
    assert bio["birthday"] == {"day": 27, "month": 2}
    assert bio["source"] == "umapyoi.net"
    assert data["character"]["character"]["img"] is True


def test_hub_lists_npcs(player):
    npcs = player.get("/api/hub").json()["npcs"]
    assert {"tazuna", "yayoi", "etsuko"} <= set(npcs)


def test_migration_upgrades_v1_database(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'v1.db'}")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, nickname VARCHAR(16))"))
        conn.execute(text("CREATE TABLE feed_events (id INTEGER PRIMARY KEY, icon VARCHAR(8), message VARCHAR(200))"))
        conn.execute(text("INSERT INTO feed_events (icon, message) VALUES ('🌟', 'conseguiu [5⭐ Gold Ship] com 80 pity.')"))

    upgrade_schema(engine)
    upgrade_schema(engine)  # rodar duas vezes não pode quebrar

    cols = {c["name"] for c in inspect(engine).get_columns("users")}
    assert "avatar_character_id" in cols
    with engine.connect() as conn:
        icon, message = conn.execute(text("SELECT icon, message FROM feed_events")).one()
    assert icon == "star-burst"
    assert message == "conseguiu [5★ Gold Ship] com 80 pity."
