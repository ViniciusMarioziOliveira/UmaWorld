"""Configurações lidas de variáveis de ambiente (com padrões para desenvolvimento)."""
import logging
import os
from pathlib import Path

from sqlalchemy.engine import make_url

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

log = logging.getLogger("umaworld")


def _load_dotenv() -> None:
    """Carrega um arquivo .env simples (CHAVE=valor), sem dependências extras."""
    env_file = BASE_DIR / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
PASSWORD_PLACEHOLDER = "YOUR-PASSWORD"  # como o Supabase mostra a URI: ...:[YOUR-PASSWORD]@...


def resolve_database_url(raw: str | None, password: str | None = None) -> str:
    """Monta a URL do banco a partir de DATABASE_URL e, se houver, DATABASE_PASSWORD.

    - Sem DATABASE_URL, usa o SQLite local (umaworld.db).
    - DATABASE_PASSWORD substitui a senha da URL: dá para colar a URI do Supabase do jeito
      que ela vem (com [YOUR-PASSWORD]), e a senha pode ter qualquer caractere.
    - Banco remoto sem "sslmode" na URL passa a exigir conexão criptografada.
    """
    if not raw:
        return f"sqlite:///{BASE_DIR / 'umaworld.db'}"
    if raw.startswith("sqlite"):
        return raw
    url = make_url(raw)
    # Render/Heroku/Supabase entregam "postgres://" ou "postgresql://"; o SQLAlchemy precisa do driver.
    if url.drivername in ("postgres", "postgresql"):
        url = url.set(drivername="postgresql+psycopg")
    if password:
        url = url.set(password=password)
    elif PASSWORD_PLACEHOLDER in (url.password or ""):
        # Falha antes de conectar: o Supabase bloqueia o IP depois de 2 senhas erradas seguidas.
        raise RuntimeError("DATABASE_URL ainda tem [YOUR-PASSWORD]: coloque a senha do banco "
                           "em DATABASE_PASSWORD no .env (veja GUIA_BANCO_DE_DADOS.md).")
    if url.host and url.host not in LOCAL_HOSTS and "sslmode" not in url.query:
        url = url.update_query_dict({"sslmode": "require"})
    return url.render_as_string(hide_password=False)


_load_dotenv()

DATABASE_URL = resolve_database_url(os.getenv("DATABASE_URL"), os.getenv("DATABASE_PASSWORD"))
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-umaworld-troque-esta-chave-em-producao")
TOKEN_TTL_HOURS = int(os.getenv("TOKEN_TTL_HOURS", "168"))
GAME_TIMEZONE = os.getenv("GAME_TIMEZONE", "America/Sao_Paulo")

if SECRET_KEY.startswith("dev-"):
    log.warning("SECRET_KEY padrão em uso — defina SECRET_KEY em produção.")
