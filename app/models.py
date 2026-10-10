"""Tabelas do UmaWorld.

Catálogo (preenchido pelo seed, não muda em tempo de execução):
    characters, skills, character_skills, items, missions, shop_offers, announcements

Estado dos jogadores:
    users, user_characters, user_character_skills, inventory, pity, pulls,
    farms, user_missions, purchases

Servidor:
    feed_events (histórico do chat global), server_stats (contadores globais)
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .game.clock import utcnow

# ---------------------------------------------------------------- catálogo


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    rarity: Mapped[int] = mapped_column(Integer)
    distance: Mapped[str] = mapped_column(String(10))
    style: Mapped[str] = mapped_column(String(16))
    color: Mapped[str] = mapped_column(String(9))
    pool: Mapped[str] = mapped_column(String(10))  # "standard" | "limited" | "farm"
    base_speed: Mapped[int] = mapped_column(Integer)
    base_stamina: Mapped[int] = mapped_column(Integer)
    base_power: Mapped[int] = mapped_column(Integer)
    base_guts: Mapped[int] = mapped_column(Integer)
    base_wit: Mapped[int] = mapped_column(Integer)

    # Só carrega se alguém pedir: o jogo lê as habilidades da personagem do jogador (UserCharacter).
    skills: Mapped[list["CharacterSkill"]] = relationship(order_by="CharacterSkill.slot")


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(10))  # "unique" | "generic"
    power_bonus: Mapped[float] = mapped_column(Float)  # bônus de poder por nível


class CharacterSkill(Base):
    __tablename__ = "character_skills"

    character_id: Mapped[str] = mapped_column(ForeignKey("characters.id"), primary_key=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"), primary_key=True)
    slot: Mapped[int] = mapped_column(Integer)


class Item(Base):
    __tablename__ = "items"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    # ticket | xp | material | equipment | frame | title
    category: Mapped[str] = mapped_column(String(12))
    rarity: Mapped[int] = mapped_column(Integer)
    icon: Mapped[str] = mapped_column(String(40))
    description: Mapped[str] = mapped_column(String(200))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    category: Mapped[str] = mapped_column(String(12))  # daily | weekly | achievement
    icon: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(String(200))
    event: Mapped[str] = mapped_column(String(30), index=True)
    mode: Mapped[str] = mapped_column(String(6))  # "count" soma | "max" guarda o maior valor
    target: Mapped[int] = mapped_column(Integer)
    rewards: Mapped[dict] = mapped_column(JSON)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class ShopOffer(Base):
    __tablename__ = "shop_offers"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    tab: Mapped[str] = mapped_column(String(12))  # moedas | carats | fragmentos | cosmeticos
    name: Mapped[str] = mapped_column(String(80))
    icon: Mapped[str] = mapped_column(String(40))
    rarity: Mapped[int] = mapped_column(Integer)
    rewards: Mapped[dict] = mapped_column(JSON)
    currency: Mapped[str] = mapped_column(String(10))  # coins | carats | fragments
    price: Mapped[int] = mapped_column(Integer)
    limit_period: Mapped[Optional[str]] = mapped_column(String(8))  # daily | weekly | once | None
    limit_count: Mapped[Optional[int]] = mapped_column(Integer)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(primary_key=True)
    icon: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(80))
    body: Mapped[str] = mapped_column(String(500))
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ---------------------------------------------------------------- jogadores


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    nickname: Mapped[str] = mapped_column(String(16))
    nickname_key: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_login_day: Mapped[Optional[str]] = mapped_column(String(10))

    level: Mapped[int] = mapped_column(Integer, default=1)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    coins: Mapped[int] = mapped_column(BigInteger, default=0)
    carats: Mapped[int] = mapped_column(Integer, default=0)
    fragments: Mapped[int] = mapped_column(Integer, default=0)

    total_pulls: Mapped[int] = mapped_column(Integer, default=0, index=True)
    five_star_count: Mapped[int] = mapped_column(Integer, default=0)
    afk_collections: Mapped[int] = mapped_column(Integer, default=0)

    title_item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("items.id"))
    frame_item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("items.id"))
    # Corredora que anda pelo mundo (uma personagem que o jogador possui).
    avatar_character_id: Mapped[Optional[str]] = mapped_column(String(40))

    title: Mapped[Optional[Item]] = relationship(foreign_keys=[title_item_id], lazy="joined")
    frame: Mapped[Optional[Item]] = relationship(foreign_keys=[frame_item_id], lazy="joined")

    __table_args__ = (Index("ix_users_level_xp", "level", "xp"),)


class UserCharacter(Base):
    __tablename__ = "user_characters"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    character_id: Mapped[str] = mapped_column(ForeignKey("characters.id"))
    level: Mapped[int] = mapped_column(Integer, default=1)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    ascension: Mapped[int] = mapped_column(Integer, default=0)
    awakening: Mapped[int] = mapped_column(Integer, default=0)
    bonus_speed: Mapped[int] = mapped_column(Integer, default=0)
    bonus_stamina: Mapped[int] = mapped_column(Integer, default=0)
    bonus_power: Mapped[int] = mapped_column(Integer, default=0)
    bonus_guts: Mapped[int] = mapped_column(Integer, default=0)
    bonus_wit: Mapped[int] = mapped_column(Integer, default=0)
    equipment_item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("items.id"))
    afk_slot: Mapped[Optional[int]] = mapped_column(Integer)
    favorite_slot: Mapped[Optional[int]] = mapped_column(Integer)
    power: Mapped[int] = mapped_column(Integer, default=0, index=True)
    obtained_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    character: Mapped[Character] = relationship(lazy="joined")
    equipment: Mapped[Optional[Item]] = relationship(lazy="joined")
    skills: Mapped[list["UserCharacterSkill"]] = relationship(
        lazy="selectin", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("user_id", "character_id"),)


class UserCharacterSkill(Base):
    __tablename__ = "user_character_skills"

    user_character_id: Mapped[int] = mapped_column(
        ForeignKey("user_characters.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"), primary_key=True)
    slot: Mapped[int] = mapped_column(Integer)
    level: Mapped[int] = mapped_column(Integer, default=1)

    skill: Mapped[Skill] = relationship(lazy="joined")


class InventoryItem(Base):
    __tablename__ = "inventory"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    item_id: Mapped[str] = mapped_column(ForeignKey("items.id"), primary_key=True)
    qty: Mapped[int] = mapped_column(Integer, default=0)

    item: Mapped[Item] = relationship(lazy="joined")


class PityState(Base):
    __tablename__ = "pity"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    banner_type: Mapped[str] = mapped_column(String(10), primary_key=True)
    pity5: Mapped[int] = mapped_column(Integer, default=0)
    pity4: Mapped[int] = mapped_column(Integer, default=0)
    guaranteed: Mapped[bool] = mapped_column(Boolean, default=False)
    total: Mapped[int] = mapped_column(Integer, default=0)
    # Pulls que contam para a troca (gacha.SPARK_COST = uma 5★ à escolha) e trocas já feitas.
    spark: Mapped[int] = mapped_column(Integer, default=0)
    exchanges: Mapped[int] = mapped_column(Integer, default=0)


class Pull(Base):
    __tablename__ = "pulls"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    banner_type: Mapped[str] = mapped_column(String(10))
    banner_id: Mapped[str] = mapped_column(String(40))
    character_id: Mapped[str] = mapped_column(ForeignKey("characters.id"))
    rarity: Mapped[int] = mapped_column(Integer)
    pity: Mapped[int] = mapped_column(Integer)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    outcome: Mapped[str] = mapped_column(String(12))  # new | awakening | fragments
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    character: Mapped[Character] = relationship(lazy="joined")

    __table_args__ = (
        Index("ix_pulls_user_id_id", "user_id", "id"),
        Index("ix_pulls_rarity_created", "rarity", "created_at"),
    )


class Farm(Base):
    __tablename__ = "farms"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    level: Mapped[int] = mapped_column(Integer, default=1)
    storage_level: Mapped[int] = mapped_column(Integer, default=1)
    last_collected_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    carry: Mapped[dict] = mapped_column(JSON, default=dict)  # frações acumuladas entre coletas


class UserMission(Base):
    __tablename__ = "user_missions"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    mission_id: Mapped[str] = mapped_column(ForeignKey("missions.id"), primary_key=True)
    period_key: Mapped[str] = mapped_column(String(12), primary_key=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class Purchase(Base):
    __tablename__ = "purchases"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    offer_id: Mapped[str] = mapped_column(ForeignKey("shop_offers.id"), primary_key=True)
    period_key: Mapped[str] = mapped_column(String(12), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)


# ---------------------------------------------------------------- servidor


class FeedEvent(Base):
    __tablename__ = "feed_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(20))
    icon: Mapped[str] = mapped_column(String(40))
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    nickname: Mapped[Optional[str]] = mapped_column(String(16))
    message: Mapped[str] = mapped_column(String(200))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class ServerStat(Base):
    __tablename__ = "server_stats"

    key: Mapped[str] = mapped_column(String(30), primary_key=True)
    value: Mapped[int] = mapped_column(BigInteger, default=0)
