import pytest
from sqlalchemy.engine import make_url

from app.config import resolve_database_url

# Como o Supabase mostra a URI do Session pooler (botão Connect).
SUPABASE = "postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres"


def test_without_url_uses_local_sqlite():
    assert resolve_database_url(None).startswith("sqlite:///")
    assert resolve_database_url("").startswith("sqlite:///")


def test_separate_password_accepts_any_character():
    password = "p@ss:w/rd#?%+ çã"
    url = make_url(resolve_database_url(SUPABASE, password))
    assert url.drivername == "postgresql+psycopg"
    assert url.username == "postgres.abcdefgh"
    assert url.password == password
    assert url.host == "aws-1-us-east-1.pooler.supabase.com"
    assert url.port == 5432
    assert url.query["sslmode"] == "require"


def test_placeholder_without_password_fails_before_connecting():
    with pytest.raises(RuntimeError, match="DATABASE_PASSWORD"):
        resolve_database_url(SUPABASE)


def test_keeps_explicit_sslmode_and_fixes_postgres_scheme():
    url = make_url(resolve_database_url("postgres://u:p@db.exemplo.com/jogo?sslmode=verify-full"))
    assert url.drivername == "postgresql+psycopg"
    assert url.query["sslmode"] == "verify-full"


def test_local_postgres_does_not_require_ssl():
    url = make_url(resolve_database_url("postgresql://u:p@127.0.0.1:5433/jogo"))
    assert "sslmode" not in url.query
