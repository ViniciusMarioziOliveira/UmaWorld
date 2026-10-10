"""Validação das requisições."""
from typing import Annotated, Literal

from pydantic import BaseModel, Field

StatName = Literal["speed", "stamina", "power", "guts", "wit"]


class RegisterIn(BaseModel):
    nickname: str = Field(min_length=3, max_length=16, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=6, max_length=64)


class LoginIn(BaseModel):
    nickname: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=128)


class PullIn(BaseModel):
    banner: Literal["limited", "duo", "standard"] | None = None
    # Nome do campo antes da Dupla Estelar. Só uma tela desatualizada manda isso, e "limited"
    # não diz qual dos dois banners limitados ela mostra: o servidor pede para recarregar.
    banner_type: str | None = None
    count: int = Field(ge=1, le=10)


class ExchangeIn(BaseModel):
    banner: Literal["limited", "duo", "standard"]
    character: str = Field(max_length=40)


class LevelIn(BaseModel):
    manuals: dict[str, Annotated[int, Field(ge=0, le=9999)]] = Field(default_factory=dict, max_length=3)


class AttributeIn(BaseModel):
    stat: StatName
    times: int = Field(default=1, ge=1, le=10)


class SkillIn(BaseModel):
    skill_id: str = Field(max_length=40)


class EquipIn(BaseModel):
    item_id: str | None = Field(default=None, max_length=40)


class UpgradeIn(BaseModel):
    kind: Literal["farm", "storage"]


class HelpersIn(BaseModel):
    slots: list[int | None] = Field(min_length=3, max_length=3)


class BuyIn(BaseModel):
    quantity: int = Field(default=1, ge=1, le=99)


class ClaimAllIn(BaseModel):
    category: Literal["daily", "weekly", "achievement"]


class ProfileIn(BaseModel):
    avatar_uc_id: int | None = None
    title_item_id: str | None = Field(default=None, max_length=40)
    frame_item_id: str | None = Field(default=None, max_length=40)
    favorites: list[int] | None = Field(default=None, max_length=3)
