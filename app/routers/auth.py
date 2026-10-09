from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..game import afk, feed, missions
from ..game.catalog import STARTER_CHARACTER, STARTER_KIT
from ..game.rewards import grant, obtain_character
from ..game.serializers import user_summary
from ..schemas import LoginIn, RegisterIn
from ..security import RateLimiter, create_token, hash_password, locked_user, verify_password
from .common import badges

router = APIRouter(prefix="/api", tags=["auth"])

login_limiter = RateLimiter(limit=10, window_seconds=300)
register_limiter = RateLimiter(limit=20, window_seconds=3600)


def _ip(request: Request) -> str:
    # Atrás de um proxy (Render/Railway), o último IP da lista é o que o proxy viu;
    # os anteriores podem ter sido inventados pelo próprio cliente.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "?"


@router.post("/auth/register")
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    if not register_limiter.allow(_ip(request)):
        raise HTTPException(429, "Muitos cadastros deste endereço. Tente mais tarde.")
    key = body.nickname.lower()
    if db.scalar(select(m.User.id).where(m.User.nickname_key == key)):
        raise HTTPException(409, "Este apelido já está em uso.")

    user = m.User(nickname=body.nickname, nickname_key=key, password_hash=hash_password(body.password),
                  title_item_id="titulo_novato", avatar_character_id=STARTER_CHARACTER)
    try:
        db.add(user)
        db.flush()
        grant(db, user, STARTER_KIT)
        obtain_character(db, user, STARTER_CHARACTER)
        afk.get_farm(db, user)
        missions.record_login(db, user)
        feed.emit(db, "new_player", "wave", "chegou ao UmaWorld!", user)
        db.flush()
        payload = {"token": create_token(user.id), "me": user_summary(db, user)}
        db.commit()
    except IntegrityError:  # outro cadastro levou o mesmo apelido ao mesmo tempo
        db.rollback()
        raise HTTPException(409, "Este apelido já está em uso.")
    return payload


@router.post("/auth/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    key = body.nickname.lower()
    if not login_limiter.allow(f"{_ip(request)}:{key}"):
        raise HTTPException(429, "Muitas tentativas. Aguarde alguns minutos.")
    user = db.scalar(select(m.User).where(m.User.nickname_key == key))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Apelido ou senha incorretos.")
    missions.record_login(db, user)
    payload = {"token": create_token(user.id), "me": user_summary(db, user)}
    db.commit()
    return payload


@router.get("/me")
def me(user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    missions.record_login(db, user)  # conta o login diário mesmo com o token salvo
    payload = {"me": user_summary(db, user), "badges": badges(db, user)}
    db.commit()
    return payload