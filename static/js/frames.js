// Molduras de perfil desenhadas em SVG, por cima do avatar redondo.
//
// O desenho ocupa 144% do avatar (viewBox 100x100, centro 50,50): o retrato vai até o raio
// 34,7 e a moldura fica entre ele e a borda. Três níveis de detalhe, pelo tamanho do avatar:
//   - pequeno (chat, lista de online): só o anel, em CSS (sem SVG);
//   - médio (HUD, ranking): o anel e o emblema da moldura (classe fa-md);
//   - grande (perfil, Loja, prévia): tudo, com as animações (classe fa-lg).
// Os gradientes ficam num <svg> único no documento (FRAME_DEFS), compartilhado por todas.

const C = 50;
const f = (n) => n.toFixed(2);
const pt = (r, deg) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];
const ring = (r, attrs) => `<circle cx="50" cy="50" r="${r}" fill="none" ${attrs}/>`;

/** Arco de `a` a `b` graus no raio `r` (sentido horário, ângulos do SVG: 0 = direita, 90 = baixo). */
function arc(r, a, b) {
  const [x0, y0] = pt(r, a);
  const [x1, y1] = pt(r, b);
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
}

/** Pétala de cerejeira (com o entalhe na ponta), de tamanho 1, apontando para cima a partir da origem. */
const SAKURA_PETAL = 'M0 0C-.55-.22-.62-.82-.2-1L0-.84L.2-1C.62-.82.55-.22 0 0Z';

function blossom(cx, cy, s, rot) {
  const petals = Array.from({ length: 5 }, (_, i) =>
    `<path d="${SAKURA_PETAL}" transform="rotate(${rot + i * 72}) scale(${s})"/>`).join('');
  return `<g transform="translate(${f(cx)} ${f(cy)})" fill="url(#fr-petal)" stroke="#f472a6" stroke-width="${f(0.5 / s)}">
    ${petals}<circle r="${f(s * 0.24)}" fill="#ffe08a" stroke="none"/></g>`;
}

/** Estrela de quatro pontas (brilho). */
function spark(cx, cy, s, cls = '') {
  return `<path class="${cls}" d="M${f(cx)} ${f(cy - s)}Q${f(cx)} ${f(cy)} ${f(cx + s)} ${f(cy)}Q${f(cx)} ${f(cy)} ${f(cx)} ${f(cy + s)}`
    + `Q${f(cx)} ${f(cy)} ${f(cx - s)} ${f(cy)}Q${f(cx)} ${f(cy)} ${f(cx)} ${f(cy - s)}Z" fill="#fff"/>`;
}

// ------------------------------------------------------------- Turfe (3★): grama de pista

function turf() {
  // Tufos de grama na metade de baixo, de alturas variadas (fixas, para não "piscar" a cada desenho).
  const blades = (from, to, step, r0, tilt, k) => {
    let d = '';
    for (let a = from, i = 0; a <= to; a += step, i += 1) {
      const h = 3.6 + ((i * k) % 5) * 0.75;
      const [x0, y0] = pt(r0, a - 1.5);
      const [x1, y1] = pt(r0, a + 1.5);
      const [xt, yt] = pt(r0 + h, a + (a < 90 ? -tilt : tilt));
      d += `M${f(x0)} ${f(y0)}L${f(xt)} ${f(yt)}L${f(x1)} ${f(y1)}Z`;
    }
    return d;
  };
  const posts = Array.from({ length: 24 }, (_, i) => {
    const [x, y] = pt(40.6, i * 15 + 7.5);
    return `<circle cx="${f(x)}" cy="${f(y)}" r=".95"/>`;
  }).join('');
  return `
    ${ring(37.2, 'stroke="url(#fr-turf)" stroke-width="5"')}
    ${ring(37.2, 'stroke="#c9f5d3" stroke-opacity=".38" stroke-width="5" stroke-dasharray="3.9 3.9"')}
    ${ring(34.9, 'stroke="#fff" stroke-width="1"')}
    <g class="fa-lg">
      <path d="${blades(24, 156, 5.5, 39.4, 3, 3)}" fill="#1f8a48"/>
      <path d="${blades(27, 153, 5.5, 39.4, 2, 2)}" fill="#46c36f"/>
    </g>
    ${ring(40.6, 'stroke="#fff" stroke-width="1.1"')}
    <g class="fa-lg" fill="#fff">${posts}</g>
    <g class="fa-md">
      <path d="M45.3 85.6A4.9 4.9 0 1 0 54.7 85.6" fill="none" stroke="#8a5a00" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M45.3 85.6A4.9 4.9 0 1 0 54.7 85.6" fill="none" stroke="url(#fr-gold)" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="45.9" cy="88.7" r=".45" fill="#6b4500"/><circle cx="50" cy="91.4" r=".45" fill="#6b4500"/>
      <circle cx="54.1" cy="88.7" r=".45" fill="#6b4500"/>
    </g>`;
}

// ------------------------------------------------------------- Sakura (4★): pétalas de cerejeira

function sakura() {
  const twig = (a, len) => {
    const [x0, y0] = pt(41.6, a);
    const [x1, y1] = pt(41.6 + len, a - 7);
    return `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`;
  };
  const flowers = [[176, 41.8, 3.1, 10], [212, 42.6, 3.8, 40], [250, 42.2, 3.2, 70], [287, 43, 4.2, 15], [326, 41.5, 2.6, 55]];
  const loose = [[38, 42.4, 2.9, 25], [64, 43.2, 2.3, 60]];
  // A animação (CSS) move a pétala dentro do próprio grupo: posição, giro e tamanho ficam no <g>.
  const fall = (cls, x, y, s, rot) =>
    `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path class="fa-drift ${cls}" d="${SAKURA_PETAL}" fill="url(#fr-petal)"/></g>`;
  return `
    ${ring(37.2, 'stroke="url(#fr-sakura)" stroke-width="5"')}
    ${ring(37.2, 'stroke="#fff" stroke-opacity=".45" stroke-width="5" stroke-dasharray=".8 6.2"')}
    ${ring(34.9, 'stroke="#fff" stroke-width="1"')}
    ${ring(39.9, 'stroke="#ffd1e3" stroke-width=".8"')}
    <g class="fa-lg">
      <path d="${arc(41.6, 160, 300)}" fill="none" stroke="#7a4a3a" stroke-width="1.7" stroke-linecap="round"/>
      <path d="${twig(196, 4.6)}${twig(232, 5.2)}${twig(268, 4)}" fill="none" stroke="#7a4a3a" stroke-width="1" stroke-linecap="round"/>
      ${flowers.map(([a, r, s, rot]) => blossom(...pt(r, a), s, rot)).join('')}
      ${loose.map(([a, r, s, rot]) => blossom(...pt(r, a), s, rot)).join('')}
      ${fall('d1', 84, 22, 2.2, 30)}${fall('d2', 90, 46, 1.8, -20)}${fall('d3', 80, 70, 2, 60)}
    </g>
    <g class="fa-md fa-only-md">${blossom(...pt(42.6, 302), 4.4, 15)}</g>`;
}

// ------------------------------------------------------------- Estelar (5★): céu estrelado

function stellar() {
  const dots = [0, 34, 71, 103, 140, 176, 212, 247, 283, 318].map((a, i) => {
    const [x, y] = pt(37.2 + (i % 2 ? 1 : -1.1), a);
    return `<circle class="fa-tw" style="--d:${(i * 0.37) % 2.2}s" cx="${f(x)}" cy="${f(y)}" r="${i % 3 ? 0.55 : 0.85}" fill="#fff"/>`;
  }).join('');
  const [mx, my] = pt(43.6, -42);
  const comet = Array.from({ length: 6 }, (_, i) => {
    const [x, y] = pt(43, -90 - i * 3.4);
    return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.35 - i * 0.2)}" fill="#fff" fill-opacity="${f(1 - i * 0.16)}"/>`;
  }).join('');
  return `
    ${ring(37.2, 'stroke="url(#fr-night)" stroke-width="5.6"')}
    ${ring(34.7, 'stroke="#c9bcff" stroke-width=".8"')}
    ${ring(40.1, 'stroke="#8e7dff" stroke-width=".7" stroke-opacity=".8"')}
    <g class="fa-lg">${dots}</g>
    <g class="fa-md">
      <circle cx="${f(mx)}" cy="${f(my)}" r="5.4" fill="url(#fr-moon)" mask="url(#fr-crescent)"/>
    </g>
    <g class="fa-lg">
      ${spark(...pt(46, 214), 4.6, 'fa-spark')}${spark(...pt(45, 38), 3, 'fa-spark s2')}${spark(...pt(46.5, 146), 2.4, 'fa-spark s3')}
      <g class="fa-orbit">${comet}</g>
    </g>`;
}

// ------------------------------------------------------------- Dourada (5★): coroa de louros

function gold() {
  const leaves = (from, to, dir) => {
    let out = '';
    for (let a = from, i = 0; dir > 0 ? a <= to : a >= to; a += 13 * dir, i += 1) {
      const side = i % 2 ? 1.25 : -1.15;
      const [x, y] = pt(42.7 + side, a);
      const rot = a + 90 * dir + (i % 2 ? 32 : -32) * dir;
      out += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="3.2" ry="1.35" transform="rotate(${f(rot)} ${f(x)} ${f(y)})"/>`;
    }
    return out;
  };
  return `
    ${ring(37.2, 'stroke="#8a5a00" stroke-width="6.4"')}
    ${ring(37.2, 'stroke="url(#fr-gold)" stroke-width="5.2"')}
    ${ring(35.4, 'stroke="#fff7d6" stroke-width=".55" stroke-opacity=".9"')}
    <g class="fa-lg">
      <circle class="fa-glint" cx="50" cy="50" r="37.2" fill="none" stroke="#fff" stroke-width="5.2" stroke-opacity=".55" stroke-dasharray="7 227" stroke-linecap="round"/>
      <path d="${arc(42.7, 98, 232)}" fill="none" stroke="#9c6a06" stroke-width=".8"/>
      <path d="${arc(42.7, 308, 442)}" fill="none" stroke="#9c6a06" stroke-width=".8"/>
      <g fill="url(#fr-leaf)" stroke="#8a5a00" stroke-width=".35">${leaves(100, 230, 1)}${leaves(80, -50, -1)}</g>
      <path d="M50 85.4L53.5 89.4L50 93.4L46.5 89.4Z" fill="url(#fr-gem)" stroke="url(#fr-gold)" stroke-width="1"/>
    </g>
    <g class="fa-md">
      <path d="M42.6 12.8L43.6 5.6L47 8.9L50 3.4L53 8.9L56.4 5.6L57.4 12.8Z" fill="url(#fr-gold)" stroke="#8a5a00" stroke-width=".7" stroke-linejoin="round"/>
      <rect x="42.6" y="11.4" width="14.8" height="2.3" rx=".8" fill="#c98a00" stroke="#8a5a00" stroke-width=".5"/>
      <circle cx="50" cy="3.6" r="1.25" fill="#e5484d" stroke="#fff3c4" stroke-width=".4"/>
      <circle cx="43.6" cy="5.8" r=".95" fill="#2f8cff" stroke="#fff3c4" stroke-width=".4"/>
      <circle cx="56.4" cy="5.8" r=".95" fill="#2f8cff" stroke="#fff3c4" stroke-width=".4"/>
    </g>`;
}

const ART = { turf, sakura, stellar, gold };
const cache = {};

export const FRAME_DEFS = `
  <svg aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">
    <defs>
      <linearGradient id="fr-turf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ee08f"/><stop offset="1" stop-color="#16884a"/></linearGradient>
      <linearGradient id="fr-sakura" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd6e6"/><stop offset=".55" stop-color="#ff9cc4"/><stop offset="1" stop-color="#f06aa3"/></linearGradient>
      <radialGradient id="fr-petal"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#ffd0e2"/><stop offset="1" stop-color="#ff8fbd"/></radialGradient>
      <linearGradient id="fr-night" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b3a9c"/><stop offset=".45" stop-color="#151a4a"/><stop offset="1" stop-color="#6c5ce7"/></linearGradient>
      <radialGradient id="fr-moon" cx=".35" cy=".35"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#ffd56e"/></radialGradient>
      <mask id="fr-crescent" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <circle cx="${f(pt(43.6, -42)[0])}" cy="${f(pt(43.6, -42)[1])}" r="5.4" fill="#fff"/>
        <circle cx="${f(pt(43.6, -42)[0] + 2.6)}" cy="${f(pt(43.6, -42)[1] - 1.7)}" r="4.6" fill="#000"/>
      </mask>
      <linearGradient id="fr-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff4c7"/><stop offset=".22" stop-color="#f6c544"/><stop offset=".48" stop-color="#b8800a"/>
        <stop offset=".7" stop-color="#ffe28f"/><stop offset="1" stop-color="#c98a00"/>
      </linearGradient>
      <linearGradient id="fr-leaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a6"/><stop offset="1" stop-color="#c48a0b"/></linearGradient>
      <linearGradient id="fr-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a9a"/><stop offset="1" stop-color="#c81e3a"/></linearGradient>
    </defs>
  </svg>`;

let defsReady = false;

/** O desenho de uma moldura (o "css" do item), ou '' se ela não tiver arte. */
export function frameArt(css) {
  if (!ART[css]) return '';
  if (!defsReady) {
    defsReady = true;
    document.body.insertAdjacentHTML('afterbegin', FRAME_DEFS);
  }
  cache[css] ??= `<svg class="frame-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${ART[css]()}</svg>`;
  return cache[css];
}

/** Nível de detalhe pelo tamanho do avatar, em pixels. */
export const frameTier = (size) => (size >= 64 ? 'fz-lg' : size >= 34 ? 'fz-md' : 'fz-sm');
