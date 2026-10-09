// Mapa da Academia Tracen. Coordenadas em "pixels do mundo" (o motor aplica zoom).
//
//   [Templo]  [Loja] [Refeitório]   [ Academia Tracen ]   [Hall da Fama]   [Treino]
//      |________|_________|_________________|________________|_______________|
//    lago          mesas          [   Praça Central   ] ──── [Missões]    pista de treino
//      |                                    |                       [Dormitório]
//   [Fazenda]     [Casa] ─── jardim central ─┼─── [Armazém]   [Clube] [Jardim do Chá]
//   ═══════════════════════ calçadão ══ [Mirante] ══ calçadão ════════════════════
//   ~~~~~~~~ cerca: daqui para baixo é a Pista de Corrida, só para olhar ~~~~~~~~

export const WORLD = { w: 3600, h: 3360 };
export const BOUNDS = { x0: 170, y0: 300, x1: 3430, y1: 2330 };
export const PLAZA = { x: 1800, y: 1070, r: 270 };
export const POND = { x: 470, y: 1250, rx: 220, ry: 130 };
export const FIELD = { x: 470, y: 1706, w: 700, h: 330 };
export const TERRACE = { x: 1800, y: 2330, rx: 330, ry: 120 };
export const SPAWN = { x: 1800, y: 1290 };
// Parado aqui, a câmera se afasta e desce para mostrar a pista inteira.
export const OVERLOOK = { x: 1500, y: 2190, w: 600, h: 140 };

// Pista de corrida (fora da área andável): reta de 2*hs, curvas de meia elipse (rx, ry).
// Grama do lado de fora da linha de base, areia do lado de dentro, como nos hipódromos japoneses.
export const TRACK = { cx: 1800, cy: 2900, hs: 1050, rx: 430, ry: 270, turf: 92, dirt: 74 };
export const SCREEN = { x: 1800, y: 2990 }; // telão no meio da pista (base)

/** Ponto e direção a `s` px do início de uma faixa da pista (sentido anti-horário na tela). */
export function trackPoint(s, offset = 0) {
  const { cx, cy, hs } = TRACK;
  const a = TRACK.rx + offset;
  const b = TRACK.ry + offset;
  const straight = hs * 2;
  const half = (Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))) / 2;
  const total = 2 * straight + 2 * half;
  let d = ((s % total) + total) % total;
  if (d < straight) return { x: cx + hs - d, y: cy - b, dx: -1, dy: 0, total };
  d -= straight;
  if (d < half) {
    const f = (Math.PI * d) / half;
    return { x: cx - hs - a * Math.sin(f), y: cy - b * Math.cos(f), dx: -a * Math.cos(f), dy: b * Math.sin(f), total };
  }
  d -= half;
  if (d < straight) return { x: cx - hs + d, y: cy + b, dx: 1, dy: 0, total };
  d -= straight;
  const f = (Math.PI * d) / half;
  return { x: cx + hs + a * Math.sin(f), y: cy + b * Math.cos(f), dx: a * Math.cos(f), dy: -b * Math.sin(f), total };
}

// Caminhos de terra (desenhados no chão; só decorativos, não bloqueiam nada).
export const PATHS = [
  'M330 820 H3300',                        // avenida norte
  'M475 636 V820', 'M955 688 V820', 'M1295 690 V820', 'M2445 614 V820', 'M3015 648 V820',
  'M1800 590 V2250',                       // eixo central: Academia, Praça, jardim e Mirante
  'M820 1100 H3370', 'M820 820 V1600',     // avenida do meio e acesso à Fazenda
  'M1290 1690 V1820 H3370', 'M2345 1690 V1820', 'M2900 1770 V1820', 'M3070 1440 V1820',
  'M3370 1100 V2250', 'M2595 2130 V2250',
  'M260 2250 H3340',                       // calçadão do Mirante
].join(' ');

// Prédios: caixa do desenho (x, y, w, h) e porta (ponto central da soleira).
export const BUILDINGS = [
  { id: 'gacha', kind: 'shrine', route: 'gacha', label: 'Templo da Sorte', icon: 'gacha', tone: 'pink',
    x: 330, y: 380, w: 290, h: 256, door: { x: 475, y: 636 } },
  { id: 'loja', kind: 'shop', route: 'loja', label: 'Loja', icon: 'shop', tone: 'pink',
    x: 830, y: 470, w: 250, h: 218, door: { x: 955, y: 688 } },
  { id: 'hall', kind: 'hall', route: 'ranking', label: 'Hall da Fama', icon: 'ranking', tone: 'gold',
    x: 2290, y: 360, w: 310, h: 254, door: { x: 2445, y: 614 } },
  { id: 'treino', kind: 'gym', route: 'treino', label: 'Centro de Treinamento', icon: 'training', tone: 'sky',
    x: 2860, y: 400, w: 310, h: 248, door: { x: 3015, y: 648 } },
  { id: 'missoes', kind: 'guild', route: 'missoes', label: 'Escritório de Missões', icon: 'missions', tone: 'green',
    x: 2470, y: 860, w: 240, h: 218, door: { x: 2590, y: 1078 } },
  { id: 'casa', kind: 'house', route: 'perfil', label: 'Sua Casa', icon: 'home', tone: 'purple',
    x: 1180, y: 1480, w: 220, h: 210, door: { x: 1290, y: 1690 } },
  { id: 'armazem', kind: 'warehouse', route: 'armazem', label: 'Armazém', icon: 'storage', tone: 'ink',
    x: 2210, y: 1472, w: 270, h: 218, door: { x: 2345, y: 1690 } },
  // A fazenda é entrada pelo portão; o celeiro fica lá dentro, só de enfeite.
  { id: 'afk', kind: 'gate', route: 'afk', label: 'Fazenda', icon: 'farm', tone: 'gold', prop: true,
    x: 715, y: 1580, w: 210, h: 128, door: { x: 820, y: 1696 },
    trigger: { x: 766, y: 1622, w: 108, h: 76 }, exit: { x: 820, y: 1642 } },
];

// Prédios só de enfeite (bloqueiam a passagem, mas não abrem nada).
export const DECOR_BUILDINGS = [
  { id: 'academia', kind: 'academy', label: 'Academia Tracen', x: 1500, y: 110, w: 600, h: 480 },
  { id: 'refeitorio', kind: 'cafe', label: 'Refeitório', x: 1150, y: 470, w: 290, h: 220 },
  { id: 'dormitorio', kind: 'dorm', label: 'Dormitório', x: 2840, y: 1180, w: 460, h: 260 },
  { id: 'gazebo', kind: 'gazebo', label: 'Jardim do Chá', x: 2780, y: 1560, w: 240, h: 210 },
  { id: 'clube', kind: 'clubroom', label: 'Clube de Corrida', x: 2480, y: 1960, w: 230, h: 170 },
  { id: 'celeiro', kind: 'barn', x: 670, y: 1786, w: 300, h: 240, inField: true },
  // Fora da cerca: só aparecem quando a câmera mostra a pista.
  { id: 'arquibancada', kind: 'grandstand', x: 2300, y: 2366, w: 980, h: 172, outside: true },
];

// Objetos: (x, y) = ponto de apoio no chão (a base). `col` = colisão.
const T = (x, y, variant = 'green') => ({ kind: 'tree', x, y, w: 150, h: 176, variant,
  col: { ellipse: { x, y: y - 8, rx: 18, ry: 11 } } });
const LAMP = (x, y) => ({ kind: 'lamp', x, y, w: 30, h: 118, col: { rect: { x: x - 6, y: y - 8, w: 12, h: 10 } } });
const BENCH = (x, y) => ({ kind: 'bench', x, y, w: 96, h: 52, col: { rect: { x: x - 46, y: y - 16, w: 92, h: 16 } } });
const BUSH = (x, y, variant) => ({ kind: 'bush', x, y, w: 80, h: 54, variant });
const BED = (x, y, w, variant = 'pink') => ({ kind: 'flowerbed', x, y, w, h: 46, variant,
  col: { rect: { x: x - w / 2 + 4, y: y - 26, w: w - 8, h: 22 } } });

export const PROPS = [
  // Praça Central: a Fonte das Três Deusas, o quadro de avisos e bancos
  { kind: 'goddess', x: 1800, y: 1110, w: 300, h: 260, ax: 150, ay: 200,
    col: { ellipse: { x: 1800, y: 1104, rx: 138, ry: 64 } } },
  { kind: 'board', id: 'board', x: 1960, y: 912, w: 124, h: 118, talk: 'board',
    col: { rect: { x: 1908, y: 898, w: 104, h: 16 } } },
  LAMP(1600, 880), LAMP(2000, 1270), LAMP(1600, 1270), LAMP(2060, 860),
  BENCH(1690, 1300), BENCH(1910, 1300),
  BED(1590, 1080, 70, 'yellow'), BED(2010, 1080, 70, 'yellow'),

  // Templo da Sorte
  { kind: 'torii', x: 475, y: 772, w: 176, h: 156,
    cols: [{ rect: { x: 409, y: 758, w: 20, h: 14 } }, { rect: { x: 521, y: 758, w: 20, h: 14 } }] },
  { kind: 'lantern', x: 400, y: 704, w: 44, h: 78, col: { rect: { x: 388, y: 694, w: 24, h: 10 } } },
  { kind: 'lantern', x: 550, y: 704, w: 44, h: 78, col: { rect: { x: 538, y: 694, w: 24, h: 10 } } },
  { kind: 'nobori', id: 'nobori1', x: 330, y: 770, w: 40, h: 128, col: { rect: { x: 330, y: 762, w: 12, h: 8 } } },
  { kind: 'nobori', id: 'nobori2', x: 618, y: 770, w: 40, h: 128, col: { rect: { x: 618, y: 762, w: 12, h: 8 } } },
  { kind: 'omikuji', x: 250, y: 650, w: 70, h: 92, col: { rect: { x: 220, y: 636, w: 60, h: 14 } } },

  // Refeitório: mesas com guarda-sol
  { kind: 'parasol', x: 1215, y: 990, w: 120, h: 132, variant: 'pink', col: { ellipse: { x: 1215, y: 984, rx: 44, ry: 16 } } },
  { kind: 'parasol', x: 1385, y: 1000, w: 120, h: 132, variant: 'mint', col: { ellipse: { x: 1385, y: 994, rx: 44, ry: 16 } } },
  { kind: 'menu', x: 1110, y: 720, w: 54, h: 70, col: { rect: { x: 1090, y: 712, w: 40, h: 10 } } },
  { kind: 'vending', x: 1470, y: 690, w: 60, h: 100, col: { rect: { x: 1442, y: 676, w: 56, h: 16 } } },

  // Academia Tracen
  BED(1620, 650, 120, 'red'), BED(1980, 650, 120, 'red'),
  { kind: 'flagpole', x: 1520, y: 650, w: 70, h: 210, col: { rect: { x: 1514, y: 642, w: 14, h: 10 } } },

  // Centro de Treinamento e pista de treino
  { kind: 'tires', x: 3130, y: 930, w: 120, h: 70, col: { rect: { x: 3074, y: 906, w: 112, h: 26 } } },
  { kind: 'hurdle', x: 3290, y: 900, w: 90, h: 64, col: { rect: { x: 3249, y: 892, w: 82, h: 10 } } },
  { kind: 'hurdle', x: 3290, y: 990, w: 90, h: 64, col: { rect: { x: 3249, y: 982, w: 82, h: 10 } } },
  { kind: 'cones', x: 3020, y: 990, w: 110, h: 44 },
  { kind: 'labtable', x: 3290, y: 720, w: 110, h: 84, col: { rect: { x: 3238, y: 700, w: 104, h: 22 } } },
  BED(2730, 690, 120, 'blue'),

  // Lago e Fazenda
  { kind: 'fishing', x: 655, y: 1290, w: 120, h: 110 },
  { kind: 'reeds', x: 290, y: 1180, w: 70, h: 60 }, { kind: 'reeds', x: 640, y: 1360, w: 70, h: 60 },
  { kind: 'haystack', x: 560, y: 1830, w: 80, h: 60 },
  { kind: 'haystack', x: 1080, y: 1880, w: 80, h: 60 },
  { kind: 'scarecrow', x: 1060, y: 1990, w: 70, h: 110 },
  { kind: 'mailbox', x: 1430, y: 1690, w: 36, h: 70, col: { rect: { x: 1422, y: 1682, w: 16, h: 8 } } },

  // Jardim central (entre a Casa e o Armazém)
  BED(1660, 1500, 150), BED(1940, 1500, 150, 'blue'),
  BED(1660, 1700, 150, 'blue'), BED(1940, 1700, 150),
  BED(1660, 1900, 150, 'yellow'), BED(1940, 1900, 150, 'yellow'),
  BENCH(1640, 2050), BENCH(1960, 2050),
  { kind: 'signpost', x: 1880, y: 1400, w: 90, h: 110, col: { rect: { x: 1874, y: 1392, w: 12, h: 10 } } },

  // Missões, Armazém, Dormitório, Clube e Jardim do Chá
  { kind: 'crates', x: 2530, y: 1700, w: 96, h: 74, col: { rect: { x: 2486, y: 1674, w: 90, h: 26 } } },
  { kind: 'bikes', x: 2750, y: 1470, w: 120, h: 70, col: { rect: { x: 2694, y: 1452, w: 112, h: 18 } } },
  BED(2840, 1880, 110, 'pink'), BED(3000, 1880, 110, 'pink'),
  { kind: 'teatable', x: 3120, y: 1720, w: 96, h: 70, col: { ellipse: { x: 3120, y: 1712, rx: 40, ry: 14 } } },
  { kind: 'whiteboard', x: 2770, y: 2140, w: 110, h: 74, col: { rect: { x: 2718, y: 2120, w: 104, h: 20 } } },

  // Calçadão e Mirante
  ...[420, 780, 1140, 2460, 2820, 3180].map((x) => LAMP(x, 2200)),
  BENCH(600, 2210), BENCH(1000, 2210), BENCH(2640, 2210), BENCH(3000, 2210),
  { kind: 'binoculars', x: 1660, y: 2320, w: 46, h: 76, col: { rect: { x: 1650, y: 2312, w: 20, h: 10 } } },
  { kind: 'binoculars', x: 2140, y: 2320, w: 46, h: 76, col: { rect: { x: 2130, y: 2312, w: 20, h: 10 } } },

  // Pista de corrida (fora da cerca, só para olhar)
  { kind: 'finishpost', x: 2700, y: 2716, w: 40, h: 120 },
  { kind: 'startgate', x: 1150, y: 3274, w: 220, h: 150 },
  T(760, 2880, 'deep'), T(1500, 3000), T(2280, 2830), T(2440, 3010, 'deep'), T(2980, 2860), T(2860, 3040, 'deep'),
  BUSH(420, 2470), BUSH(820, 2480, 'flower'), BUSH(1260, 2470), BUSH(2210, 2490, 'flower'),

  // Árvores e arbustos
  T(250, 470, 'sakura'), T(690, 560, 'sakura'), T(230, 900, 'sakura'), T(690, 960, 'sakura'),
  T(240, 360, 'deep'), T(700, 370), T(1150, 340, 'deep'), T(1420, 360),
  T(2180, 340, 'deep'), T(2730, 340), T(3300, 360, 'deep'), T(3380, 560),
  T(980, 980, 'deep'), T(1080, 1250), T(1450, 1300, 'deep'), T(2150, 1270), T(2340, 1000, 'deep'),
  T(2860, 1000), T(3330, 1060, 'deep'),
  T(220, 1480, 'deep'), T(650, 1520), T(1050, 1420, 'deep'), T(1470, 1960), T(2100, 1640, 'deep'),
  T(2600, 1400), T(3300, 1560, 'deep'), T(3330, 1960),
  T(2330, 1300, 'sakura'), T(2560, 1240, 'sakura'), T(2650, 1610, 'sakura'),
  BED(2440, 1340, 120, 'pink'), BENCH(2450, 1400), BUSH(2210, 1380, 'flower'),
  T(240, 1780), T(250, 2060, 'deep'), T(1280, 2010, 'deep'), T(1450, 2120), T(2250, 2080),
  T(2900, 2080, 'deep'), T(3150, 2120),
  BUSH(880, 1020, 'flower'), BUSH(1500, 940), BUSH(2160, 990, 'flower'), BUSH(2780, 1080),
  BUSH(330, 1600), BUSH(1150, 1600, 'flower'), BUSH(2480, 1610, 'flower'), BUSH(3240, 1460),
  BUSH(330, 1080, 'flower'), BUSH(1060, 760), BUSH(2200, 700, 'flower'), BUSH(3240, 760),
];

// NPCs fixos da Academia (arte oficial via umapyoi). `talk` define o que acontece ao interagir.
export const NPCS = [
  { id: 'tazuna', x: 2045, y: 930, talk: 'praca', name: 'Tazuna Hayakawa', role: 'Secretária da Academia',
    lines: ['Boas-vindas à Academia Tracen! Os avisos ficam no quadro aqui ao lado.',
      'As missões diárias renovam à meia-noite. Não esqueça de resgatar!',
      'Que tal visitar o Templo da Sorte hoje? A Dupla Estelar acabou de chegar.'] },
  { id: 'etsuko', x: 1560, y: 960, talk: 'news', name: 'Etsuko Otonashi', role: 'Repórter',
    lines: ['Extra, extra! Fico de olho em cada 5★ do servidor.', 'Nenhum furo ainda... mas a sorte muda rápido!'] },
  { id: 'yayoi', x: 1690, y: 690, talk: 'lines', name: 'Yayoi Akikawa', role: 'Diretora',
    lines: ['Excelente! Esforço é o que leva ao Hall da Fama!', 'Ambição! Treine, corra e alcance o topo!',
      'Uma boa corredora cuida da fazenda também. Colete seus recursos!'] },
];

// Umas pela Academia: viram, pulam e puxam conversa quando a jogadora chega perto.
// move: 'stay' (fica no lugar), 'wander' (passeia num raio) ou 'patrol' (vai e volta entre a e b).
// talk: o que acontece ao conversar ('lines' ou 'duo', que leva ao banner da Dupla Estelar).
export const UMAS = [
  { id: 'forever_young', name: 'Forever Young', x: 360, y: 900, move: 'stay', talk: 'duo', emote: 'star',
    greet: 'Hey! A Dupla Estelar abriu no Templo da Sorte!',
    lines: ['Corri o mundo inteiro e voltei para cá. Agora é a sua vez de me chamar!',
      'Areia, grama, chuva... qualquer pista é pista para mim.', 'Vem, vou te mostrar o banner!'] },
  { id: 'marche_lorraine', name: 'Marche Lorraine', x: 590, y: 900, move: 'stay', talk: 'duo', emote: 'star',
    greet: 'Bonjour! Quer conhecer o banner da Dupla Estelar?',
    lines: ['Ninguém achava que eu venceria longe de casa. Eu marchei mesmo assim.',
      'A Forever Young e eu estamos no mesmo banner. Boa sorte no 50/50!', 'Vamos ao Templo? Eu mostro o caminho.'] },
  { id: 'matikanefukukitaru', name: 'Fukukitaru', x: 200, y: 760, move: 'stay', emote: 'crystal',
    greet: 'A bola de cristal brilhou quando você chegou!',
    lines: ['A sorte de hoje aponta para o Holofote: {featured}!',
      'Shirafuku-sama diz que um 5★ está a caminho... ou um 3★. O destino é tímido.',
      'Antes de girar o gacha, dê três voltas no torii. Funciona! Às vezes.'] },
  { id: 'special_week', name: 'Special Week', x: 1290, y: 930, move: 'wander', radius: 70, emote: 'carrot',
    greet: 'Oi! Você também veio pelo cheiro do refeitório?',
    lines: ['Hoje tem cenoura grelhada no cardápio! Já pedi três pratos.',
      'Prometi à minha mãe que vou ser a melhor Uma Musume do Japão!',
      'Correr de barriga cheia é o segredo. Eu acho.'] },
  { id: 'oguri_cap', name: 'Oguri Cap', x: 1440, y: 1010, move: 'stay', emote: 'carrot',
    greet: '...Você vai comer isso?',
    lines: ['Correr dá fome. Comer dá vontade de correr. É um ciclo perfeito.',
      'Ainda cabe mais um prato. Sempre cabe.', 'A Tamamo diz que eu exagero. Não vejo onde.'] },
  { id: 'symboli_rudolf', name: 'Symboli Rudolf', x: 1910, y: 690, move: 'stay', emote: 'crown',
    greet: 'Boas-vindas. Que todas as Uma Musume possam ser felizes.',
    lines: ['Sabe por que a cenoura é a rainha da horta? Porque tem coroa. ...Ahem.',
      'Como presidente do conselho estudantil, conto com o seu esforço.',
      'Uma vitória só tem valor quando todas correram com o coração.'] },
  { id: 'sakura_bakushin_o', name: 'Bakushin O', x: 2100, y: 880, move: 'patrol',
    a: { x: 2090, y: 880 }, b: { x: 2260, y: 880 }, speed: 300, emote: 'speed',
    greet: 'Bakushin! Bakushin! Siga a representante de turma!',
    lines: ['Velocidade máxima em tudo: nas aulas, no almoço e no corredor!',
      'Qualquer distância é curta se você correr rápido o suficiente!', 'Bakushiiin!'] },
  { id: 'tokai_teio', name: 'Tokai Teio', x: 3120, y: 820, move: 'wander', radius: 110, emote: 'sparkle',
    greet: 'Hehe! Veio ver a Teio treinar?',
    lines: ['Vou conquistar a Tríplice Coroa, igualzinho ao Kaichou!', 'Viu meu passo? Leve como uma pena!',
      'Treino é bom, mas um copo de mel depois é melhor ainda.'] },
  { id: 'agnes_tachyon', name: 'Agnes Tachyon', x: 3230, y: 760, move: 'stay', emote: 'stats',
    greet: 'Ah, uma cobaia... digo, uma visita!',
    lines: ['Você aceitaria provar uma bebida nova? É pela ciência.',
      'Qual é o limite da velocidade de uma Uma Musume? Quero descobrir.',
      'Seus dados de passada são... fascinantes. Posso anotar?'] },
  { id: 'gold_ship', name: 'Gold Ship', x: 718, y: 1300, move: 'stay', emote: 'sparkle',
    greet: 'Psiu! Não espanta o peixe!',
    lines: ['Estou pescando um tubarão. Ou um submarino. O que morder primeiro.',
      'Quer entrar no meu time de bobsled? Ainda não temos trenó.', 'Hoje o meu humor é: navio pirata.'] },
  { id: 'haru_urara', name: 'Haru Urara', x: 980, y: 1650, move: 'wander', radius: 90, emote: 'heart',
    greet: 'Oiii! Vamos correr juntas?',
    lines: ['Perdi de novo, mas foi tão divertido!', 'As cenouras da fazenda são as mais gostosas do mundo!',
      'Um dia eu ganho uma corrida! Talvez amanhã!'] },
  { id: 'rice_shower', name: 'Rice Shower', x: 1560, y: 1600, move: 'wander', radius: 60, emote: 'heart',
    greet: 'A-ah! Oi... você também gosta das flores?',
    lines: ['Rice quer trazer felicidade para todo mundo.', 'As flores azuis são as minhas favoritas.',
      'Rice vai se esforçar no treino de hoje!'] },
  { id: 'mejiro_mcqueen', name: 'Mejiro McQueen', x: 3050, y: 1800, move: 'stay', emote: 'heart',
    greet: 'Ah, chegou bem na hora do chá.',
    lines: ['Uma dama Mejiro nunca exagera nos doces... Bem, só hoje.',
      'A elegância deve continuar até a reta final.', 'Estou de olho no peso. Este bolo não conta.'] },
  { id: 'silence_suzuka', name: 'Silence Suzuka', x: 1990, y: 2300, move: 'stay', emote: 'flag',
    greet: 'Daqui dá para ver a pista inteira.',
    lines: ['Gosto da paisagem que só quem lidera consegue ver.',
      'Olhando as outras correrem, dá vontade de correr também.', 'Na frente, o vento sopra diferente.'] },
  { id: 'twin_turbo', name: 'Twin Turbo', x: 2400, y: 2270, move: 'patrol',
    a: { x: 2380, y: 2270 }, b: { x: 3250, y: 2270 }, speed: 330, emote: 'bolt',
    greet: 'Sai da frente! A Turbo vai passar!',
    lines: ['A Turbo vai na frente do começo ao fim! ...Quase sempre.',
      'Fôlego? Isso é coisa de quem corre devagar!', 'Hoje eu ganhei da Turbo de ontem!'] },
];

// Quem corre na pista lá embaixo: faixa (offset da linha de base), ponto de partida e ritmo.
export const RUNNERS = [
  { id: 'daiwa_scarlet', offset: -38, start: 0, pace: 380 },
  { id: 'vodka', offset: -14, start: 90, pace: 376 },
  { id: 'el_condor_pasa', offset: 30, start: 1500, pace: 360 },
  { id: 'grass_wonder', offset: 58, start: 1580, pace: 366 },
  { id: 'mihono_bourbon', offset: -30, start: 3600, pace: 350 },
  { id: 'kitasan_black', offset: 44, start: 5200, pace: 372 },
];

export const DOOR_W = 92;

export function doorTrigger(b) {
  return b.trigger || { x: b.door.x - DOOR_W / 2, y: b.door.y - 6, w: DOOR_W, h: 60 };
}

export function doorExit(b) {
  return b.exit || { x: b.door.x, y: b.door.y + 42 };
}

/** Lista de colisores (retângulos e elipses) usados pelo movimento e pelo pathfinding. */
export function buildColliders() {
  const out = [];
  const { x0, y0, x1, y1 } = BOUNDS;
  out.push({ rect: { x: -100, y: -100, w: WORLD.w + 200, h: y0 + 100 } });
  out.push({ rect: { x: -100, y: y1, w: WORLD.w + 200, h: WORLD.h - y1 + 100 } });
  out.push({ rect: { x: -100, y: -100, w: x0 + 100, h: WORLD.h + 200 } });
  out.push({ rect: { x: x1, y: -100, w: WORLD.w - x1 + 100, h: WORLD.h + 200 } });
  for (const b of [...BUILDINGS, ...DECOR_BUILDINGS]) {
    if (b.prop || b.inField || b.outside) continue;
    out.push({ rect: { x: b.x + 14, y: b.y + 46, w: b.w - 28, h: b.h - 50 } });
  }
  out.push({ rect: { x: FIELD.x - 6, y: FIELD.y - 10, w: FIELD.w + 12, h: FIELD.h + 16 } });
  const gate = BUILDINGS.find((b) => b.id === 'afk');
  out.push({ rect: { x: gate.x + 9, y: gate.y + 104, w: 24, h: 14 } }, { rect: { x: gate.x + 177, y: gate.y + 104, w: 24, h: 14 } });
  out.push({ ellipse: { x: POND.x, y: POND.y, rx: POND.rx + 8, ry: POND.ry + 6 } });
  for (const p of PROPS) {
    if (p.col) out.push(p.col);
    if (p.cols) out.push(...p.cols);
  }
  for (const n of NPCS) out.push({ ellipse: { x: n.x, y: n.y - 4, rx: 16, ry: 9 } });
  for (const u of UMAS) if (u.move === 'stay') out.push({ ellipse: { x: u.x, y: u.y - 4, rx: 16, ry: 9 } });
  return out;
}

const ZONES = [
  ...BUILDINGS.map((b) => ({ name: b.label, x: b.door.x, y: b.door.y + 40, r: 190 })),
  ...DECOR_BUILDINGS.filter((b) => b.label).map((b) => ({ name: b.label, x: b.x + b.w / 2, y: b.y + b.h, r: 200 })),
  { name: 'Templo da Sorte', x: 475, y: 840, r: 250 },
  { name: 'Refeitório', x: 1300, y: 960, r: 220 },
  { name: 'Academia Tracen', x: 1800, y: 690, r: 200 },
  { name: 'Praça Central', x: PLAZA.x, y: PLAZA.y, r: PLAZA.r + 50 },
  { name: 'Lago', x: POND.x, y: POND.y, r: 260 },
  { name: 'Jardim Central', x: 1800, y: 1700, r: 260 },
  { name: 'Pista de Treino', x: 3180, y: 920, r: 200 },
  { name: 'Calçadão', x: 800, y: 2250, r: 560 },
  { name: 'Calçadão', x: 2900, y: 2250, r: 560 },
  { name: 'Mirante da Pista', x: TERRACE.x, y: 2280, r: 330 },
];

export function zoneAt(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const z of ZONES) {
    const d = Math.hypot(x - z.x, y - z.y);
    if (d < z.r && d < bestD) { best = z; bestD = d; }
  }
  return best ? best.name : 'Academia Tracen';
}

export function inOverlook(x, y) {
  return x >= OVERLOOK.x && x <= OVERLOOK.x + OVERLOOK.w && y >= OVERLOOK.y && y <= OVERLOOK.y + OVERLOOK.h;
}
