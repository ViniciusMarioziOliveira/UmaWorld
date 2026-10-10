"""Sincroniza dados e imagens das personagens a partir da API pública do umapyoi.net.

Uso:
    python -m tools.sync_umapyoi                       # baixa só o que falta
    python -m tools.sync_umapyoi --force               # baixa tudo de novo
    python -m tools.sync_umapyoi --only mejiro_ramonu  # só estas personagens (o resto fica como está)

Gera arquivos locais (o jogo NUNCA chama o umapyoi em tempo de execução):
    app/game/data/umas.json            dados oficiais (perfil, cores, aniversário...)
    static/img/umas/<id>/icon.webp     ícone 160px (avatares, listas)
    static/img/umas/<id>/card.webp     busto (cards)
    static/img/umas/<id>/sprite.webp   corpo inteiro recortado (personagem andando no mundo)
    static/img/umas/<id>/full.webp     corpo inteiro grande (banner, treino, revelação)

As imagens oficiais ficam no CDN do microCMS, que aceita parâmetros de transformação
(trim, h, w, fm=webp). Assim cada arquivo já chega recortado e leve: a arte de corpo
inteiro cai de ~680 KB (PNG 1125x1980) para ~16 KB (WebP 112x320).

Uma Musume Pretty Derby © Cygames, Inc. Dados: umapyoi.net.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.game.catalog import CHARACTERS  # noqa: E402

API = "https://umapyoi.net/api/v1"
DATA_OUT = ROOT / "app" / "game" / "data" / "umas.json"
IMG_DIR = ROOT / "static" / "img" / "umas"
USER_AGENT = "UmaWorld/1.0 (projeto de portfolio, fan-made, sem fins lucrativos)"
API_PAUSE = 0.35  # gentileza com a API (é um projeto de fã também)

# NPCs da Academia Tracen que aparecem no mundo.
NPCS = {
    "tazuna": "hayakawatazuna",
    "yayoi": "akikawayayoi",
    "etsuko": "otonashietsuko",
}

OUTFIT_PREFERENCE = ("Racewear", "Uniform", "Default")

# nome do arquivo: (campo da API ou "outfit", parâmetros do CDN)
IMAGES = {
    "icon": ("sns_icon", "w=160&fm=webp&q=82"),
    "card": ("thumb_img", "w=240&fm=webp&q=80"),
    "sprite": ("outfit", "trim=auto&h=320&fm=webp&q=82"),
    "full": ("outfit", "trim=auto&h=960&fm=webp&q=80"),
}
NPC_IMAGES = ("icon", "sprite")

PROFILE_FIELDS = (
    "name_jp", "height", "shoe_size", "weight", "grade", "residence", "slogan", "profile",
    "strengths", "weaknesses", "ears_fact", "tail_fact", "family_fact", "link",
)


def http_get(url: str, retries: int = 3) -> bytes:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=40) as res:
                return res.read()
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == retries - 1:
                raise
            print(f"   tentando de novo ({exc})")
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("inalcançável")


def api(path: str):
    data = json.loads(http_get(f"{API}/{path}"))
    time.sleep(API_PAUSE)
    return data


def pick_outfit(groups: list[dict]) -> tuple[str, str] | None:
    """Escolhe a roupa (de preferência a de corrida) com imagem no CDN do microCMS."""
    def cdn_image(group):
        return next((i["image"] for i in group["images"] if "microcms-assets.io" in i["image"]), None)

    by_label = {g["label_en"]: g for g in groups}
    for label in OUTFIT_PREFERENCE:
        if label in by_label and cdn_image(by_label[label]):
            return label, cdn_image(by_label[label])
    for group in groups:
        if cdn_image(group):
            return group["label_en"], cdn_image(group)
    return None


def download(url: str, params: str, dest: Path, force: bool) -> bool:
    if dest.exists() and not force:
        return False
    sep = "&" if "?" in url else "?"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(http_get(f"{url}{sep}{params}"))
    return True


def sync_one(our_id: str, entry: dict, wanted: tuple[str, ...], force: bool) -> dict:
    detail = api(f"character/{entry['id']}")
    groups = api(f"character/images/{entry['id']}") or []
    outfit = pick_outfit(groups)

    sources = {"sns_icon": detail.get("sns_icon"), "thumb_img": detail.get("thumb_img"),
               "outfit": outfit[1] if outfit else None}
    images = {}
    for name in wanted:
        field, params = IMAGES[name]
        url = sources.get(field)
        if not url:
            continue
        fetched = download(url, params, IMG_DIR / our_id / f"{name}.webp", force)
        images[name] = True
        if fetched:
            time.sleep(0.1)

    data = {
        "umapyoi_id": entry["id"],
        "game_id": detail.get("game_id"),
        "name_en": detail.get("name_en", "").replace("​", ""),
        "color_main": detail.get("color_main"),
        "color_sub": detail.get("color_sub"),
        "birthday": {"day": detail.get("birth_day"), "month": detail.get("birth_month")},
        "sizes": {"b": detail.get("size_b"), "w": detail.get("size_w"), "h": detail.get("size_h")},
        "outfit": outfit[0] if outfit else None,
        "images": images,
    }
    for field in PROFILE_FIELDS:
        data[field] = detail.get(field)
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--force", action="store_true", help="baixa todas as imagens de novo")
    parser.add_argument("--only", nargs="+", metavar="ID", help="sincroniza só estas personagens (ids do catalog.py)")
    args = parser.parse_args()
    known = {row[0] for row in CHARACTERS}
    if args.only and not set(args.only) <= known:
        print(f"Ids fora do catalog.py: {sorted(set(args.only) - known)}")
        return 1

    print("Buscando a lista de personagens no umapyoi.net…")
    listing = api("character/list")
    by_internal = {c["name_en_internal"]: c for c in listing}

    out = {
        "source": "https://umapyoi.net",
        "copyright": "Uma Musume Pretty Derby © Cygames, Inc.",
        "synced_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "characters": {},
        "npcs": {},
    }
    if args.only:  # parte do arquivo atual: as outras personagens e os NPCs não mudam
        current = json.loads(DATA_OUT.read_text(encoding="utf-8"))
        out["characters"], out["npcs"] = current["characters"], current["npcs"]
    missing = []
    for row in CHARACTERS:
        our_id = row[0]
        if args.only and our_id not in args.only:
            continue
        entry = by_internal.get(our_id.replace("_", ""))
        if entry is None:
            missing.append(our_id)
            continue
        print(f" - {row[1]}")
        out["characters"][our_id] = sync_one(our_id, entry, tuple(IMAGES), args.force)

    for npc_id, internal in NPCS.items():
        if args.only:
            break
        entry = by_internal.get(internal)
        if entry is None:
            missing.append(npc_id)
            continue
        print(f" - NPC {entry['name_en']}")
        out["npcs"][npc_id] = sync_one(f"npc_{npc_id}", entry, NPC_IMAGES, args.force)
    # Mesma ordem do catalog.py, com ou sem --only.
    out["characters"] = {row[0]: out["characters"][row[0]] for row in CHARACTERS if row[0] in out["characters"]}

    DATA_OUT.parent.mkdir(parents=True, exist_ok=True)
    DATA_OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    size = sum(f.stat().st_size for f in IMG_DIR.rglob("*.webp"))
    print(f"\n{len(out['characters'])} personagens e {len(out['npcs'])} NPCs -> {DATA_OUT.relative_to(ROOT)}")
    print(f"Imagens: {size / 1024 / 1024:.1f} MB em {IMG_DIR.relative_to(ROOT)}")
    if missing:
        print(f"Não encontrados no umapyoi: {missing}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
