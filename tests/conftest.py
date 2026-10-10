import itertools
import os
import tempfile

# Banco temporário: precisa ser definido antes de importar o app.
_TMP = tempfile.mkdtemp(prefix="umaworld-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/test.db"

from datetime import timedelta  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import models as m  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.game import afk, catalog, gacha  # noqa: E402
from app.game.clock import day_start_utc  # noqa: E402
from app.main import app  # noqa: E402

_ids = itertools.count(1)
FIRST_DUO_RUN = catalog.DUO_BANNER_RUNS[0]


def at(moment):
    """Relógio parado num instante (UTC, como no banco), para trocar o `utcnow` de um módulo."""
    return lambda: moment


@pytest.fixture(autouse=True)
def no_rare_visits(monkeypatch):
    """A visitante rara da Fazenda só aparece nos testes que trocam o sorteio dela."""
    monkeypatch.setattr(afk, "rng", StubRng(0.99))


@pytest.fixture
def duo_open(monkeypatch):
    """Os testes da Dupla Estelar não podem depender da data de hoje: o relógio do gacha fica no
    2º dia do primeiro período dela."""
    monkeypatch.setattr(gacha, "utcnow", at(day_start_utc(FIRST_DUO_RUN[0]) + timedelta(days=1, hours=15)))


@pytest.fixture(scope="session")
def client():
    from app.routers import auth

    auth.register_limiter.limit = 10_000  # todos os testes cadastram do mesmo "IP"
    with TestClient(app) as c:
        yield c


class Player:
    def __init__(self, client: TestClient, nickname: str, token: str, me: dict):
        self.client = client
        self.nickname = nickname
        self.token = token
        self.me = me
        self.headers = {"Authorization": f"Bearer {token}"}

    def get(self, url, **kw):
        return self.client.get(url, headers=self.headers, **kw)

    def post(self, url, json=None):
        return self.client.post(url, headers=self.headers, json=json or {})

    def put(self, url, json=None):
        return self.client.put(url, headers=self.headers, json=json or {})

    def edit(self, fn):
        """Altera o jogador direto no banco (para preparar cenários de teste)."""
        with SessionLocal() as db:
            user = db.get(m.User, self.me["id"])
            fn(db, user)
            db.commit()


@pytest.fixture
def player(client):
    nickname = f"tester{next(_ids)}"
    res = client.post("/api/auth/register", json={"nickname": nickname, "password": "segredo123"})
    assert res.status_code == 200, res.text
    data = res.json()
    return Player(client, nickname, data["token"], data["me"])


class StubRng:
    """Substitui o sorteio: `random()` devolve sempre o mesmo valor, `choice` pega o primeiro."""

    def __init__(self, value: float):
        self.value = value

    def random(self):
        return self.value

    def choice(self, seq):
        return seq[0]

    def randint(self, a, b):
        return a
