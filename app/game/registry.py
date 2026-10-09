"""Consulta rápida (em memória) do catálogo estático + dados oficiais do umapyoi.

O catálogo também vive no banco (o seed copia tudo para lá, e as tabelas de jogadores
apontam para ele por chave estrangeira). Como ele não muda em tempo de execução,
estas tabelas em memória evitam consultas repetidas para nomes, ícones, pools e missões.

Os dados oficiais (cores, perfil, imagens) vêm de data/umas.json, gerado uma única vez
por `python -m tools.sync_umapyoi`. Sem o arquivo, o jogo funciona com as cores do
catálogo e retratos desenhados em CSS.
"""
import json
from dataclasses import dataclass
from pathlib import Path

from . import catalog

UMAS_FILE = Path(__file__).parent / "data" / "umas.json"


def _load_umas() -> dict:
    try:
        return json.loads(UMAS_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"characters": {}, "npcs": {}}


UMAS = _load_umas()
UMA_DATA: dict[str, dict] = UMAS.get("characters", {})
NPC_DATA: dict[str, dict] = UMAS.get("npcs", {})

CHAR_INFO: dict[str, dict] = {}
for (cid, name, rarity, distance, style, color, pool, skill_name, skill_desc) in catalog.CHARACTERS:
    official = UMA_DATA.get(cid, {})
    CHAR_INFO[cid] = {
        "id": cid,
        "name": name,
        "rarity": rarity,
        "distance": distance,
        "distance_label": catalog.DISTANCE_LABELS[distance],
        "style": style,
        "style_label": catalog.STYLE_LABELS[style],
        "color": official.get("color_main") or color,
        "color2": official.get("color_sub") or color,
        "img": len(official.get("images", {})) == 4,
        "pool": pool,
        "base": catalog.base_stats(cid, rarity, distance, style),
        "unique_skill": f"u_{cid}",
        "generic_skill": catalog.GENERIC_SKILLS[distance][0],
    }

ITEM_INFO: dict[str, dict] = {}
for sort, (iid, name, category, rarity, icon, desc, data) in enumerate(catalog.ITEMS):
    ITEM_INFO[iid] = {
        "id": iid,
        "name": name,
        "category": category,
        "rarity": rarity,
        "icon": icon,
        "description": desc,
        "data": data,
        "sort": sort,
    }


@dataclass(frozen=True)
class MissionInfo:
    """Uma missão do catálogo, com os mesmos campos da tabela `missions`."""

    id: str
    category: str  # daily | weekly | achievement
    icon: str
    title: str
    description: str
    event: str
    mode: str  # "count" soma | "max" guarda o maior valor
    target: int
    rewards: dict
    sort: int


MISSIONS: list[MissionInfo] = [
    MissionInfo(mid, category, icon, title, desc, event, mode, target, rewards, sort)
    for sort, (mid, category, icon, title, desc, event, mode, target, rewards) in enumerate(catalog.MISSIONS)
]
MISSION_BY_ID: dict[str, MissionInfo] = {x.id: x for x in MISSIONS}

PUBLIC_CHAR_FIELDS = ("id", "name", "rarity", "distance", "distance_label", "style", "style_label",
                      "color", "color2", "img", "pool")

BIO_FIELDS = ("name_jp", "height", "shoe_size", "weight", "grade", "residence", "slogan", "profile",
              "strengths", "weaknesses", "ears_fact", "tail_fact", "family_fact", "link")


def chars_by(rarity: int, pool: str | None = None) -> list[dict]:
    return [
        c for c in CHAR_INFO.values()
        if c["rarity"] == rarity and (pool is None or c["pool"] == pool)
    ]


def char_public(cid: str) -> dict:
    """Dados de vitrine de uma personagem (sem atributos base)."""
    c = CHAR_INFO[cid]
    return {k: c[k] for k in PUBLIC_CHAR_FIELDS}


def char_bio(cid: str) -> dict | None:
    """Ficha oficial (textos em inglês, como publicados pelo umapyoi.net)."""
    data = UMA_DATA.get(cid)
    if not data:
        return None
    bio = {k: data.get(k) for k in BIO_FIELDS}
    bio["birthday"] = data.get("birthday")
    bio["sizes"] = data.get("sizes")
    bio["outfit"] = data.get("outfit")
    bio["source"] = "umapyoi.net"
    return bio


def npc_public() -> dict:
    return {
        npc_id: {"name": d.get("name_en"), "color": d.get("color_main"), "slogan": d.get("slogan"),
                 "img": "sprite" in d.get("images", {})}
        for npc_id, d in NPC_DATA.items()
    }


def item_public(iid: str) -> dict:
    i = ITEM_INFO[iid]
    return {k: i[k] for k in ("id", "name", "category", "rarity", "icon", "description", "data")}
