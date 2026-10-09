"""Senhas (bcrypt), tokens JWT e dependências de autenticação."""
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import update
from sqlalchemy.orm import Session

from . import models as m
from .config import SECRET_KEY, TOKEN_TTL_HOURS
from .database import get_db
from .game.clock import utcnow

ALGORITHM = "HS256"


def _pw_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:72]  # limite do bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_pw_bytes(password), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_pw_bytes(password), hashed.encode())
    except ValueError:
        return False


def create_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> int | None:
    try:
        return int(jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


_bearer = HTTPBearer(auto_error=False)


def _unauthorized() -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão expirada. Faça login novamente.")


def _user_id(creds: HTTPAuthorizationCredentials | None) -> int:
    uid = decode_token(creds.credentials) if creds else None
    if uid is None:
        raise _unauthorized()
    return uid


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> m.User:
    """Para leituras."""
    user = db.get(m.User, _user_id(creds))
    if user is None:
        raise _unauthorized()
    return user


def locked_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> m.User:
    """Para ações que gastam/ganham recursos.

    O UPDATE inicial trava a linha do jogador até o commit (no SQLite, trava a escrita
    do banco). Assim duas requisições simultâneas do mesmo jogador — dois cliques
    rápidos em "10x", por exemplo — rodam uma depois da outra, e o saldo nunca é
    gasto duas vezes.
    """
    uid = _user_id(creds)
    # O RETURNING já traz o jogador: uma ida ao banco em vez de duas.
    user = db.scalar(update(m.User).where(m.User.id == uid).values(last_seen_at=utcnow()).returning(m.User))
    if user is None:
        raise _unauthorized()
    return user


class RateLimiter:
    """Limite simples em memória (suficiente para uma única instância)."""

    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window = window_seconds
        self.hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True
