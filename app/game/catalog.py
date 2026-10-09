"""Dados estáticos do jogo. O seed copia tudo isto para o banco na inicialização.

Para adicionar uma personagem, item, missão ou oferta, basta editar as listas abaixo
e reiniciar o servidor — o seed faz upsert pelo id.
"""
import hashlib

STATS = ("speed", "stamina", "power", "guts", "wit")
STAT_LABELS = {
    "speed": "Velocidade",
    "stamina": "Resistência",
    "power": "Potência",
    "guts": "Garra",
    "wit": "Inteligência",
}
DISTANCE_LABELS = {"curta": "Curta", "milha": "Milha", "media": "Média", "longa": "Longa"}
STYLE_LABELS = {
    "lider": "Líder",
    "perseguidora": "Perseguidora",
    "intermediaria": "Intermediária",
    "arremetida": "Arremetida",
}

# id, nome, raridade, distância, estilo, cor, pool, habilidade única, descrição
CHARACTERS = [
    # 5★ do banner padrão (também aparecem quando se perde o 50/50)
    ("special_week", "Special Week", 5, "media", "intermediaria", "#e0569b", "standard",
     "Estrela Cadente", "Arrancada decisiva nos metros finais."),
    ("silence_suzuka", "Silence Suzuka", 5, "milha", "lider", "#1f9d63", "standard",
     "Paisagem Silenciosa", "Lidera do início ao fim sem olhar para trás."),
    ("tokai_teio", "Tokai Teio", 5, "media", "perseguidora", "#2f6fdb", "standard",
     "Passo do Imperador", "Passadas leves que aceleram na última curva."),
    ("oguri_cap", "Oguri Cap", 5, "milha", "intermediaria", "#7d8a99", "standard",
     "Monstro Cinzento", "Força bruta que cresce quando a corrida aperta."),
    ("gold_ship", "Gold Ship", 5, "longa", "arremetida", "#c0392b", "standard",
     "Rota Imprevisível", "Ninguém sabe de onde ela vem — nem ela."),
    # 5★ limitadas: só nos banners limitados (nunca saem quando se perde o 50/50)
    ("mejiro_mcqueen", "Mejiro McQueen", 5, "longa", "perseguidora", "#8a72c9", "limited",
     "Orgulho Mejiro", "Ritmo impecável em provas longas."),
    ("admire_vega", "Admire Vega", 5, "media", "intermediaria", "#4b3f9c", "limited",
     "Constelação de Vega", "Avança guiada pelas estrelas na reta final."),
    ("symboli_rudolf", "Symboli Rudolf", 5, "media", "perseguidora", "#2e7d32", "limited",
     "Imperador Absoluto", "Domínio total da corrida desde a largada."),
    ("kitasan_black", "Kitasan Black", 5, "longa", "lider", "#3b3b58", "limited",
     "Festival da Vitória", "Contagia a pista e mantém a liderança."),
    ("satono_diamond", "Satono Diamond", 5, "longa", "perseguidora", "#1f9cc0", "limited",
     "Lapidação Perfeita", "Cada curva é um brilho a mais."),
    # 5★ da Dupla Estelar (DUO_BANNER, abaixo): ficam fora da rotação semanal
    ("forever_young", "Forever Young", 5, "media", "perseguidora", "#822b4a", "limited",
     "Juventude Eterna", "Uma força que não envelhece: acelera de novo na reta final."),
    ("marche_lorraine", "Marche Lorraine", 5, "milha", "intermediaria", "#8b1538", "limited",
     "Marcha Triunfal", "Avança em ritmo de marcha e vence longe de casa."),
    # 4★
    ("vodka", "Vodka", 4, "milha", "intermediaria", "#d9a400", "standard",
     "Atalho Rebelde", "Ultrapassa por dentro, com estilo."),
    ("daiwa_scarlet", "Daiwa Scarlet", 4, "milha", "lider", "#e03a52", "standard",
     "Primeira e Única", "Recusa-se a ficar atrás de alguém."),
    ("grass_wonder", "Grass Wonder", 4, "media", "intermediaria", "#43a047", "standard",
     "Chama Serena", "Calma por fora, fogo na reta final."),
    ("el_condor_pasa", "El Condor Pasa", 4, "milha", "perseguidora", "#ef6c00", "standard",
     "Voo do Condor", "Ataque aéreo na última curva."),
    ("mejiro_ryan", "Mejiro Ryan", 4, "media", "intermediaria", "#6fa833", "standard",
     "Músculo Mejiro", "Potência que rompe o pelotão."),
    ("rice_shower", "Rice Shower", 4, "longa", "perseguidora", "#6a1b9a", "standard",
     "Rosa Azul", "Persegue a rival até o último metro."),
    ("maruzensky", "Maruzensky", 4, "curta", "lider", "#d32f2f", "standard",
     "Supercarro", "Aceleração de outra geração."),
    ("taiki_shuttle", "Taiki Shuttle", 4, "curta", "perseguidora", "#e8a500", "standard",
     "Laço do Texas", "Arranque explosivo em provas curtas."),
    ("air_groove", "Air Groove", 4, "media", "perseguidora", "#1565c0", "standard",
     "Rainha da Disciplina", "Ritmo perfeito, sem desperdício."),
    ("mihono_bourbon", "Mihono Bourbon", 4, "media", "lider", "#e04882", "standard",
     "Modo Cyborg", "Velocidade calculada ao milímetro."),
    ("super_creek", "Super Creek", 4, "longa", "perseguidora", "#1f9688", "standard",
     "Abraço Acolhedor", "Recupera fôlego quando mais precisa."),
    ("seiun_sky", "Seiun Sky", 4, "longa", "lider", "#4a9ee0", "standard",
     "Nuvem Preguiçosa", "Engana a todas e escapa na frente."),
    # 3★
    ("haru_urara", "Haru Urara", 3, "curta", "arremetida", "#ef7fae", "standard",
     "Nunca Desista!", "Garra infinita, não importa a posição."),
    ("nice_nature", "Nice Nature", 3, "media", "intermediaria", "#3d8f41", "standard",
     "Bronze Brilhante", "Sempre presente no pódio."),
    ("king_halo", "King Halo", 3, "curta", "intermediaria", "#00897b", "standard",
     "Orgulho Real", "Determinação de quem nasceu para vencer."),
    ("agnes_tachyon", "Agnes Tachyon", 3, "media", "perseguidora", "#c9a400", "standard",
     "Partícula Táquion", "Aceleração cientificamente improvável."),
    ("winning_ticket", "Winning Ticket", 3, "media", "perseguidora", "#1e88e5", "standard",
     "Grito de Vitória", "Energia contagiante na reta final."),
    ("sakura_bakushin_o", "Sakura Bakushin O", 3, "curta", "lider", "#e2669a", "standard",
     "Bakushin!", "Velocidade máxima, sempre!"),
    ("matikanefukukitaru", "Matikanefukukitaru", 3, "media", "intermediaria", "#8d6e63", "standard",
     "Bola de Cristal", "A sorte decide o momento do ataque."),
    ("twin_turbo", "Twin Turbo", 3, "media", "lider", "#0393d6", "standard",
     "Turbo Total", "Dispara na frente e torce para aguentar."),
    ("ikuno_dictus", "Ikuno Dictus", 3, "media", "perseguidora", "#546e7a", "standard",
     "Plano Meticuloso", "Cada passo foi calculado antes."),
    ("biwa_hayahide", "Biwa Hayahide", 3, "media", "perseguidora", "#7e57c2", "standard",
     "Teoria da Vitória", "Lê a corrida melhor que ninguém."),
    ("narita_taishin", "Narita Taishin", 3, "media", "arremetida", "#00a3b8", "standard",
     "Contra-ataque Solitário", "Ultrapassa todas de uma vez no fim."),
    ("mayano_top_gun", "Mayano Top Gun", 3, "longa", "lider", "#f4511e", "standard",
     "Decolagem!", "Muda de estratégia no ar e decola."),
]

STARTER_CHARACTER = "haru_urara"

# Dupla Estelar: banner limitado com duas 5★ em destaque, aberto ao lado do Holofote da
# semana (id, nome, destaques). As duas ficam fora da rotação semanal.
DUO_BANNER = ("dupla-estelar", "Dupla Estelar", ("forever_young", "marche_lorraine"))

# Habilidade genérica (slot 2) de cada personagem, conforme a distância.
GENERIC_SKILLS = {
    "curta": ("largada_relampago", "Largada Relâmpago", "Sai na frente nos primeiros metros de provas curtas."),
    "milha": ("ritmo_de_milha", "Ritmo de Milha", "Mantém a velocidade constante na milha."),
    "media": ("folego_calculado", "Fôlego Calculado", "Administra a energia em distâncias médias."),
    "longa": ("coracao_maratonista", "Coração de Maratonista", "Recupera fôlego em provas longas."),
}
UNIQUE_SKILL_BONUS = {3: 0.025, 4: 0.03, 5: 0.04}
GENERIC_SKILL_BONUS = 0.02

_DIST_WEIGHTS = {
    "curta": {"speed": 1.25, "stamina": 0.6, "power": 1.25, "guts": 0.95, "wit": 0.95},
    "milha": {"speed": 1.3, "stamina": 0.8, "power": 1.1, "guts": 0.9, "wit": 0.9},
    "media": {"speed": 1.1, "stamina": 1.0, "power": 1.0, "guts": 0.95, "wit": 0.95},
    "longa": {"speed": 1.0, "stamina": 1.35, "power": 0.9, "guts": 0.9, "wit": 0.85},
}
_STYLE_STAT = {"lider": "speed", "perseguidora": "wit", "intermediaria": "power", "arremetida": "guts"}
_RARITY_TOTAL = {3: 360, 4: 430, 5: 510}


def base_stats(char_id: str, rarity: int, distance: str, style: str) -> dict[str, int]:
    """Atributos base gerados pela distância/estilo, com uma variação fixa por personagem."""
    weights = dict(_DIST_WEIGHTS[distance])
    weights[_STYLE_STAT[style]] += 0.15
    digest = hashlib.md5(char_id.encode()).digest()
    for i, stat in enumerate(STATS):
        weights[stat] *= 0.92 + (digest[i] / 255) * 0.16
    total = sum(weights.values())
    return {s: round(_RARITY_TOTAL[rarity] * weights[s] / total) for s in STATS}


# id, nome, categoria, raridade, ícone, descrição, dados extras
ITEMS = [
    ("ticket", "Ticket de Recrutamento", "ticket", 5, "ticket", "Vale 1 pull em qualquer banner.", {}),
    ("manual_basico", "Manual de Treino Básico", "xp", 2, "book", "Concede 300 XP a uma personagem.",
     {"xp": 300, "coins": 60}),
    ("manual_avancado", "Manual de Treino Avançado", "xp", 3, "book", "Concede 1.500 XP a uma personagem.",
     {"xp": 1500, "coins": 300}),
    ("manual_elite", "Manual de Treino de Elite", "xp", 4, "book", "Concede 6.000 XP a uma personagem.",
     {"xp": 6000, "coins": 1200}),
    ("ferradura_bronze", "Ferradura de Bronze", "material", 2, "horseshoe", "Material de ascensão (estágios 1 e 2).", {}),
    ("ferradura_prata", "Ferradura de Prata", "material", 3, "horseshoe", "Material de ascensão (estágios 2 e 3).", {}),
    ("ferradura_ouro", "Ferradura de Ouro", "material", 4, "horseshoe", "Material de ascensão (estágios 3 e 4).", {}),
    ("cenoura", "Cenoura Energética", "material", 3, "carrot", "Usada no treino focado de atributos.", {}),
    ("cristal_habilidade", "Cristal de Habilidade", "material", 3, "crystal", "Usado para evoluir habilidades.", {}),
    ("eq_sapatilha", "Sapatilha Veloz", "equipment", 4, "shoe", "+60 de Velocidade quando equipada.",
     {"stat": "speed", "value": 60}),
    ("eq_fita", "Fita de Resistência", "equipment", 4, "ribbon", "+60 de Resistência quando equipada.",
     {"stat": "stamina", "value": 60}),
    ("eq_munhequeira", "Munhequeira de Potência", "equipment", 4, "power", "+60 de Potência quando equipada.",
     {"stat": "power", "value": 60}),
    ("eq_amuleto", "Amuleto da Garra", "equipment", 4, "amulet", "+60 de Garra quando equipado.",
     {"stat": "guts", "value": 60}),
    ("eq_oculos", "Óculos de Estratégia", "equipment", 4, "glasses", "+60 de Inteligência quando equipados.",
     {"stat": "wit", "value": 60}),
    ("eq_coroa", "Coroa Tríplice", "equipment", 5, "crown", "+40 em todos os atributos quando equipada.",
     {"stat": "all", "value": 40}),
    ("moldura_turfe", "Moldura Turfe", "frame", 3, "frame", "Moldura de perfil com grama de pista.", {"css": "turf"}),
    ("moldura_sakura", "Moldura Sakura", "frame", 4, "frame", "Moldura de perfil com pétalas de cerejeira.",
     {"css": "sakura"}),
    ("moldura_estelar", "Moldura Estelar", "frame", 5, "frame", "Moldura de perfil com céu estrelado.",
     {"css": "stellar"}),
    ("moldura_dourada", "Moldura Dourada", "frame", 5, "frame", "Moldura de perfil para quem chegou ao topo.",
     {"css": "gold"}),
    ("titulo_novato", "Treinador Novato", "title", 1, "title", "Todo mundo começa em algum lugar.", {}),
    ("titulo_turfista", "Turfista de Coração", "title", 3, "title", "Vive e respira corridas.", {}),
    ("titulo_magnata", "Magnata das Moedas", "title", 4, "title", "Comprado com muitas, muitas moedas.", {}),
    ("titulo_cacador", "Caçador de Estrelas", "title", 5, "title", "Obteve a primeira personagem 5★.", {}),
    ("titulo_ouro", "Elite Dourada", "title", 4, "title", "Alcançou o Rank Ouro.", {}),
    ("titulo_ascensao", "Mão de Ouro", "title", 5, "title", "Levou uma personagem à ascensão máxima.", {}),
    ("titulo_afk", "Lenda do AFK", "title", 4, "title", "Coletou a Farm AFK 50 vezes.", {}),
    ("titulo_lenda", "Lenda da Pista", "title", 5, "title", "Completou a coleção inteira.", {}),
]

COSMETIC_CATEGORIES = ("frame", "title")

STARTER_KIT = {
    "coins": 50_000,
    "carats": 4_500,
    "items": {
        "ticket": 10,
        "manual_basico": 20,
        "manual_avancado": 8,
        "manual_elite": 2,
        "cenoura": 10,
        "cristal_habilidade": 5,
        "ferradura_bronze": 10,
        "ferradura_prata": 2,
        "titulo_novato": 1,
    },
}

# id, categoria, ícone, título, descrição, evento, modo, alvo, recompensas
MISSIONS = [
    ("d_login", "daily", "sunrise", "Bater o ponto", "Entre no UmaWorld hoje.", "login", "max", 1,
     {"coins": 2000, "carats": 30, "account_xp": 60}),
    ("d_pull", "daily", "dice", "Sorte do dia", "Faça 1 pull em qualquer banner.", "pull", "count", 1,
     {"carats": 50, "account_xp": 80}),
    ("d_afk", "daily", "wheat", "Colheita", "Colete os recursos da Farm AFK.", "afk_collect", "count", 1,
     {"coins": 3000, "items": {"manual_basico": 3}, "account_xp": 80}),
    ("d_level", "daily", "level", "Hora do treino", "Suba o nível de qualquer personagem.", "level_up", "count", 1,
     {"carats": 40, "items": {"manual_avancado": 1}, "account_xp": 80}),
    ("d_attr", "daily", "carrot", "Treino focado", "Faça 3 treinos de atributo.", "attr_train", "count", 3,
     {"coins": 4000, "account_xp": 80}),
    ("d_shop", "daily", "bag", "Freguesia fiel", "Compre qualquer item na Loja.", "shop_buy", "count", 1,
     {"coins": 1500, "account_xp": 60}),
    ("d_all", "daily", "gift", "Dever cumprido", "Resgate 5 missões diárias.", "daily_claim", "count", 5,
     {"carats": 120, "account_xp": 150}),

    ("w_pull", "weekly", "dice", "Maratona de pulls", "Faça 10 pulls.", "pull", "count", 10,
     {"items": {"ticket": 2}, "account_xp": 300}),
    ("w_afk", "weekly", "wheat", "Fazenda em dia", "Colete a Farm AFK 10 vezes.", "afk_collect", "count", 10,
     {"items": {"ferradura_prata": 3}, "account_xp": 250}),
    ("w_level", "weekly", "level", "Evolução constante", "Ganhe 20 níveis em personagens.", "level_up", "count", 20,
     {"items": {"manual_elite": 2}, "account_xp": 250}),
    ("w_skill", "weekly", "skill", "Técnica refinada", "Evolua habilidades 3 vezes.", "skill_up", "count", 3,
     {"items": {"cristal_habilidade": 4}, "account_xp": 250}),
    ("w_ascend", "weekly", "ascension", "Rompendo limites", "Faça 1 ascensão.", "ascend", "count", 1,
     {"items": {"ferradura_ouro": 1}, "carats": 200, "account_xp": 300}),
    ("w_daily", "weekly", "calendar", "Rotina de campeã", "Resgate 20 missões diárias.", "daily_claim", "count", 20,
     {"carats": 400, "account_xp": 400}),

    ("a_first5", "achievement", "star-burst", "Primeira estrela", "Obtenha sua primeira personagem 5★.",
     "five_star", "count", 1, {"carats": 500, "items": {"titulo_cacador": 1}, "account_xp": 300}),
    ("a_pull100", "achievement", "dice", "Cem tentativas", "Faça 100 pulls.", "pull", "count", 100,
     {"carats": 1000, "account_xp": 500}),
    ("a_pull500", "achievement", "dice", "Sem freio no gacha", "Faça 500 pulls.", "pull", "count", 500,
     {"items": {"ticket": 5, "moldura_estelar": 1}, "account_xp": 1000}),
    ("a_coll10", "achievement", "collection", "Começando a coleção", "Possua 10 personagens diferentes.",
     "collection", "max", 10, {"carats": 300, "account_xp": 300}),
    ("a_coll25", "achievement", "collection", "Estábulo cheio", "Possua 25 personagens diferentes.",
     "collection", "max", 25, {"carats": 1000, "items": {"moldura_sakura": 1}, "account_xp": 600}),
    ("a_collall", "achievement", "trophy", "Enciclopédia da Pista", "Complete a coleção de personagens.",
     "collection", "max", len(CHARACTERS), {"items": {"titulo_lenda": 1, "eq_coroa": 1}, "account_xp": 1500}),
    ("a_lvl10", "achievement", "rank-silver", "Experiência de pista", "Alcance o nível de conta 10 (Rank Prata).",
     "account_level", "max", 10, {"items": {"ticket": 3}}),
    ("a_lvl20", "achievement", "rank-gold", "Rank Ouro", "Alcance o nível de conta 20 (Rank Ouro).",
     "account_level", "max", 20, {"carats": 1000, "items": {"titulo_ouro": 1}}),
    ("a_maxasc", "achievement", "ascension", "Potencial máximo", "Leve uma personagem à ascensão máxima.",
     "max_ascension", "count", 1, {"items": {"titulo_ascensao": 1, "moldura_dourada": 1}, "account_xp": 800}),
    ("a_awaken", "achievement", "awakening", "Despertar total", "Desperte uma personagem até o nível 5.",
     "max_awakening", "count", 1, {"carats": 800, "account_xp": 500}),
    ("a_afk50", "achievement", "wheat", "Lenda do AFK", "Colete a Farm AFK 50 vezes.", "afk_collect", "count", 50,
     {"items": {"titulo_afk": 1}, "account_xp": 500}),
    ("a_farm10", "achievement", "farm", "Fazenda modelo", "Leve a Farm AFK ao nível 10.", "farm_level", "max", 10,
     {"carats": 1500, "account_xp": 800}),
]

# id, aba, recompensas, moeda, preço, período do limite, limite
SHOP_OFFERS = [
    ("c_manual_basico", "moedas", {"items": {"manual_basico": 5}}, "coins", 2500, "daily", 5),
    ("c_manual_avancado", "moedas", {"items": {"manual_avancado": 2}}, "coins", 6000, "daily", 3),
    ("c_cenoura", "moedas", {"items": {"cenoura": 3}}, "coins", 5000, "daily", 5),
    ("c_cristal", "moedas", {"items": {"cristal_habilidade": 1}}, "coins", 8000, "daily", 3),
    ("c_bronze", "moedas", {"items": {"ferradura_bronze": 2}}, "coins", 6000, "weekly", 10),
    ("c_prata", "moedas", {"items": {"ferradura_prata": 1}}, "coins", 15000, "weekly", 5),
    ("c_eq_sapatilha", "moedas", {"items": {"eq_sapatilha": 1}}, "coins", 30000, "weekly", 1),
    ("c_eq_fita", "moedas", {"items": {"eq_fita": 1}}, "coins", 30000, "weekly", 1),
    ("c_eq_munhequeira", "moedas", {"items": {"eq_munhequeira": 1}}, "coins", 30000, "weekly", 1),
    ("c_eq_amuleto", "moedas", {"items": {"eq_amuleto": 1}}, "coins", 30000, "weekly", 1),
    ("c_eq_oculos", "moedas", {"items": {"eq_oculos": 1}}, "coins", 30000, "weekly", 1),

    ("k_coins", "carats", {"coins": 25000}, "carats", 60, "daily", 5),
    ("k_elite", "carats", {"items": {"manual_elite": 1}}, "carats", 120, "daily", 3),
    ("k_cristal", "carats", {"items": {"cristal_habilidade": 3}}, "carats", 100, "daily", 2),
    ("k_ouro", "carats", {"items": {"ferradura_ouro": 1}}, "carats", 300, "weekly", 3),

    ("f_ticket", "fragmentos", {"items": {"ticket": 1}}, "fragments", 10, "weekly", 5),
    ("f_coroa", "fragmentos", {"items": {"eq_coroa": 1}}, "fragments", 200, "once", 1),
    # Personagens específicas: todas as 4★ e as 5★ do banner padrão (geradas abaixo).

    ("x_moldura_turfe", "cosmeticos", {"items": {"moldura_turfe": 1}}, "coins", 50000, "once", 1),
    ("x_titulo_turfista", "cosmeticos", {"items": {"titulo_turfista": 1}}, "coins", 30000, "once", 1),
    ("x_titulo_magnata", "cosmeticos", {"items": {"titulo_magnata": 1}}, "coins", 500000, "once", 1),
    ("x_moldura_sakura", "cosmeticos", {"items": {"moldura_sakura": 1}}, "fragments", 150, "once", 1),
]

CHARACTER_OFFER_PRICE = {4: 40, 5: 300}
for _c in CHARACTERS:
    _cid, _rarity, _pool = _c[0], _c[2], _c[6]
    if _rarity in CHARACTER_OFFER_PRICE and _pool == "standard":
        SHOP_OFFERS.append(
            (f"f_char_{_cid}", "fragmentos", {"character": _cid}, "fragments",
             CHARACTER_OFFER_PRICE[_rarity], None, None)
        )

ANNOUNCEMENTS = [
    # id, ícone, título, texto, fixado
    (1, "pin", "Boas-vindas ao UmaWorld!",
     "Ande pela Academia com a sua corredora: WASD ou setas para andar, Shift para correr e E para entrar. "
     "No celular, é só tocar no mapa. Tudo de importante que acontece no servidor aparece no Chat Global.", True),
    (2, "dice", "Banners semanais",
     "O banner em destaque do Templo da Sorte troca toda segunda-feira à 00:00 (horário de Brasília). "
     "Os banners limitados dividem o mesmo pity, que continua valendo entre as rotações.", False),
    (3, "info", "Projeto de portfólio",
     "UmaWorld é um projeto de fã, sem fins lucrativos. Uma Musume Pretty Derby © Cygames, Inc. "
     "Dados e artes via umapyoi.net.", False),
    (4, "sparkle", "Novo banner: Dupla Estelar",
     "Forever Young e Marche Lorraine chegaram ao Templo da Sorte, as duas 5★ em destaque no mesmo banner. "
     "Vale o 50/50 de sempre, e o pity e a garantia são os mesmos do Holofote da semana.", False),
]
