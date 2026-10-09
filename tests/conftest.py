import itertools
import os
import tempfile

# Banco temporário: precisa ser definido antes de importar o app.
_TMP = tempfile.mkdtemp(prefix="umaworld-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/test.db"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import models as m  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402

_ids = itertools.count(1)


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
