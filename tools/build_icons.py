"""Gera static/img/icons.svg (sprite com todos os ícones do jogo).

Uso:
    python -m tools.build_icons

Os ícones vêm do Iconify (https://iconify.design) e são salvos localmente:
o site não depende de nenhum CDN de ícones em tempo de execução.

- game-icons.net — CC BY 3.0 (Lorc, Delapouite e colaboradores)
- Phosphor Icons — MIT

Para adicionar um ícone: inclua uma linha em ICONS ("nome-no-jogo": "pacote:icone")
e rode o script de novo. Nomes disponíveis: https://icon-sets.iconify.design/
"""
import json
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "static" / "img" / "icons.svg"

ICONS = {
    # moedas e recursos
    "coin": "game-icons:two-coins",
    "coin-bag": "game-icons:coins",
    "carat": "game-icons:cut-diamond",
    "fragment": "game-icons:crystal-shine",
    "ticket": "game-icons:ticket",
    "xp": "game-icons:upgrade",
    "book": "game-icons:book-cover",
    "horseshoe": "game-icons:horseshoe",
    "carrot": "game-icons:carrot",
    "crystal": "game-icons:floating-crystal",
    "shoe": "game-icons:running-shoe",
    "ribbon": "game-icons:ribbon-medal",
    "amulet": "game-icons:gem-pendant",
    "glasses": "game-icons:spectacles",
    "crown": "game-icons:crown",
    "frame": "game-icons:laurel-crown",
    "title": "game-icons:quill-ink",
    # áreas do mundo
    "world": "game-icons:treasure-map",
    "plaza": "game-icons:fountain",
    "gacha": "game-icons:shinto-shrine",
    "dice": "game-icons:rolling-dices",
    "training": "game-icons:sprint",
    "farm": "game-icons:barn",
    "wheat": "game-icons:wheat",
    "storage": "game-icons:open-chest",
    "crate": "game-icons:wooden-crate",
    "missions": "game-icons:scroll-unfurled",
    "shop": "game-icons:shop",
    "home": "game-icons:house",
    "ranking": "game-icons:podium",
    "trophy": "game-icons:trophy-cup",
    "sign": "game-icons:wooden-sign",
    # feed e eventos
    "star-burst": "game-icons:star-formation",
    "rank-up": "game-icons:laurels",
    "milestone": "game-icons:progression",
    "ascension": "game-icons:stars-stack",
    "awakening": "game-icons:aura",
    "achievement": "game-icons:medal",
    "bag": "game-icons:shopping-bag",
    "wave": "ph:hand-waving-fill",
    "farmer": "game-icons:farmer",
    "flower": "game-icons:lotus-flower",
    "exchange": "game-icons:trade",
    "party": "game-icons:party-popper",
    "sunrise": "game-icons:sunrise",
    "calendar": "game-icons:calendar",
    "megaphone": "game-icons:megaphone",
    "newspaper": "game-icons:newspaper",
    "stats": "game-icons:histogram",
    "pin": "ph:push-pin-fill",
    # ranks
    "rank-bronze": "game-icons:rank-1",
    "rank-silver": "game-icons:rank-2",
    "rank-gold": "game-icons:rank-3",
    "rank-platinum": "game-icons:diamond-trophy",
    "rank-diamond": "game-icons:cut-diamond",
    "rank-legend": "game-icons:crown",
    # atributos e treino
    "speed": "game-icons:wind-slap",
    "stamina": "game-icons:heart-beats",
    "power": "game-icons:biceps",
    "guts": "game-icons:flame",
    "wit": "game-icons:brain",
    "bolt": "game-icons:power-lightning",
    "skill": "game-icons:magic-swirl",
    "level": "ph:arrow-fat-up-fill",
    "distance": "game-icons:path-distance",
    "horse": "game-icons:horse-head",
    "hammer": "game-icons:hammer-nails",
    "basket": "game-icons:basket",
    "gift": "game-icons:present",
    "talk": "game-icons:talk",
    "brush": "game-icons:paint-brush",
    "collection": "game-icons:book-pile",
    "stopwatch": "game-icons:stopwatch",
    "hourglass": "game-icons:sands-of-time",
    "flag": "game-icons:checkered-flag",
    "target": "game-icons:targeting",
    # interface
    "door": "ph:door-open-fill",
    "swap": "ph:arrows-left-right-bold",
    "lock": "ph:lock-simple-fill",
    "run": "ph:person-simple-run-fill",
    "footprints": "ph:footprints-fill",
    "users": "ph:users-three-fill",
    "eye": "ph:eye-fill",
    "sparkle": "ph:sparkle-fill",
    "info": "ph:info-fill",
    "warning": "ph:warning-fill",
    "heart": "ph:heart-fill",
    "star": "ph:star-fill",
    "chat": "ph:chat-circle-dots-fill",
    "logout": "ph:sign-out-bold",
    "close": "ph:x-bold",
    "prev": "ph:caret-left-bold",
    "next": "ph:caret-right-bold",
    "down": "ph:caret-down-bold",
    "search": "ph:magnifying-glass-bold",
    "plus": "ph:plus-bold",
    "minus": "ph:minus-bold",
    "check": "ph:check-bold",
    "history": "ph:clock-counter-clockwise-bold",
    "list": "ph:list-bullets-bold",
    "back": "ph:arrow-u-up-left-bold",
    "keyboard": "ph:keyboard",
    "tap": "ph:hand-tap",
    "mappin": "ph:map-pin-fill",
    "edit": "ph:pencil-simple-fill",
}

API = "https://api.iconify.design/{prefix}.json?icons={names}"


def fetch(prefix: str, names: list[str]) -> dict:
    url = API.format(prefix=prefix, names=",".join(sorted(set(names))))
    req = urllib.request.Request(url, headers={"User-Agent": "UmaWorld icon builder"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def main() -> int:
    by_prefix: dict[str, list[str]] = defaultdict(list)
    for ref in ICONS.values():
        prefix, name = ref.split(":")
        by_prefix[prefix].append(name)

    bodies: dict[str, tuple[str, int, int]] = {}
    for prefix, names in by_prefix.items():
        data = fetch(prefix, names)
        if data.get("not_found"):
            print(f"Não encontrados em {prefix}: {data['not_found']}")
            return 1
        width, height = data.get("width", 24), data.get("height", 24)
        for name, icon in data["icons"].items():
            bodies[f"{prefix}:{name}"] = (icon["body"], icon.get("width", width), icon.get("height", height))

    symbols = []
    for our_name, ref in sorted(ICONS.items()):
        body, w, h = bodies[ref]
        symbols.append(f'<symbol id="i-{our_name}" viewBox="0 0 {w} {h}">{body}</symbol>')

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        "<!-- Gerado por tools/build_icons.py. game-icons.net (CC BY 3.0) e Phosphor Icons (MIT). -->\n"
        '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">\n'
        + "\n".join(symbols)
        + "\n</svg>\n",
        encoding="utf-8",
    )
    print(f"{len(symbols)} ícones -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
