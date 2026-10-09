// Arte do mundo em SVG: chão (um único SVG grande) e prédios/objetos (um SVG cada,
// ordenados em profundidade pelo motor). Tudo vetorial: nítido em qualquer zoom.

import { BOUNDS, FIELD, PATHS, PLAZA, POND, TERRACE, TRACK, WORLD } from './layout.js';

const useIcon = (name, x, y, size, fill) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" style="color:${fill}"><use href="#i-${name}"/></svg>`;

const shadow = (cx, cy, rx, ry, op = 1) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#w-shadow)" opacity="${op}"/>`;

function svg(w, h, body, cls = '') {
  return `<svg class="w-art ${cls}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible">${body}</svg>`;
}

/** Telhado de duas águas visto de cima (3/4): trapézio com fileiras de telhas. */
function gableRoof(w, top, bottom, inset, color, dark, light) {
  const rows = [];
  for (let y = top + 16; y < bottom - 4; y += 15) {
    const t = (y - top) / (bottom - top);
    const x0 = inset * (1 - t) + 2;
    rows.push(`<path d="M${x0} ${y} H${w - x0}" stroke="${dark}" stroke-width="2.4" opacity=".55"/>`);
  }
  return `
    <path d="M0 ${bottom} L${inset} ${top} H${w - inset} L${w} ${bottom} Z" fill="${color}"/>
    ${rows.join('')}
    <path d="M0 ${bottom} L${inset} ${top} H${w - inset} L${w} ${bottom} Z" fill="url(#w-roof-shine)"/>
    <path d="M${inset + 2} ${top + 1} H${w - inset - 2}" stroke="${light}" stroke-width="5" stroke-linecap="round"/>
    <path d="M-2 ${bottom} H${w + 2} L${w - 3} ${bottom + 11} H3 Z" fill="${dark}"/>`;
}

function windowPane(x, y, w, h, frame = '#d6b48f', glow = false) {
  return `
    <rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="5" fill="${frame}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="url(#${glow ? 'w-glow' : 'w-glass'})"/>
    <path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}" stroke="${frame}" stroke-width="3"/>
    <path d="M${x + 5} ${y + h - 6} L${x + w / 2 - 4} ${y + 5}" stroke="#fff" stroke-width="3" opacity=".55" stroke-linecap="round"/>`;
}

function archDoor(x, y, w, h, color, trim) {
  const r = w / 2;
  return `
    <path d="M${x - 4} ${y + h} V${y + r} a${r + 4} ${r + 4} 0 0 1 ${w + 8} 0 V${y + h} Z" fill="${trim}"/>
    <path d="M${x} ${y + h} V${y + r} a${r} ${r} 0 0 1 ${w} 0 V${y + h} Z" fill="${color}"/>
    <path d="M${x + w / 2} ${y + 8} V${y + h}" stroke="#000" stroke-opacity=".15" stroke-width="2"/>
    <circle cx="${x + w - 9}" cy="${y + h * 0.62}" r="3.2" fill="#ffd75e"/>`;
}

// ------------------------------------------------------------------ prédios

const BUILDING_ART = {
  shop({ w, h }) {
    const stripes = [];
    const n = 10;
    const sw = (w - 36) / n;
    for (let i = 0; i < n; i += 1) {
      const fill = i % 2 ? '#ffffff' : '#ff6f9f';
      stripes.push(`<rect x="${18 + i * sw}" y="114" width="${sw + 0.5}" height="22" fill="${fill}"/>`);
      stripes.push(`<circle cx="${18 + i * sw + sw / 2}" cy="136" r="${sw / 2}" fill="${fill}"/>`);
    }
    return `
      ${shadow(w / 2, h - 6, w / 2 + 6, 18)}
      <rect x="18" y="92" width="${w - 36}" height="${h - 100}" rx="6" fill="#fff6ec"/>
      <rect x="18" y="92" width="${w - 36}" height="${h - 100}" rx="6" fill="url(#w-wall-shade)"/>
      <rect x="18" y="${h - 22}" width="${w - 36}" height="14" rx="4" fill="#ecd7bd"/>
      ${gableRoof(w, 14, 100, 22, '#ff86b0', '#e0588a', '#ffd3e3')}
      <rect x="${w / 2 - 54}" y="34" width="108" height="36" rx="12" fill="#fff" stroke="#e0588a" stroke-width="3"/>
      ${useIcon('shop', w / 2 - 44, 40, 24, '#e0588a')}
      <text x="${w / 2 + 12}" y="59" class="w-signtext" fill="#c43d70" text-anchor="middle">LOJA</text>
      ${stripes.join('')}
      ${windowPane(34, 154, 50, 40, '#d9b48c')}
      ${windowPane(w - 84, 154, 50, 40, '#d9b48c')}
      <circle cx="46" cy="190" r="5" fill="#ff8f3f"/><circle cx="58" cy="191" r="5" fill="#ffd34d"/><circle cx="70" cy="190" r="5" fill="#7bd36b"/>
      <rect x="${w - 80}" y="182" width="12" height="12" rx="2" fill="#7ab8ff"/><rect x="${w - 64}" y="180" width="14" height="14" rx="2" fill="#ff86b0"/>
      ${archDoor(w / 2 - 22, 148, 44, h - 156, '#9a6440', '#7b4c2f')}
      <rect x="${w / 2 - 34}" y="${h - 10}" width="68" height="7" rx="3" fill="#dfcbb0"/>
      <circle cx="${w / 2 - 40}" cy="${h - 20}" r="9" fill="#6cc46a"/><rect x="${w / 2 - 46}" y="${h - 16}" width="12" height="10" rx="2" fill="#c97a4a"/>
      <circle cx="${w / 2 + 40}" cy="${h - 20}" r="9" fill="#6cc46a"/><rect x="${w / 2 + 34}" y="${h - 16}" width="12" height="10" rx="2" fill="#c97a4a"/>`;
  },

  hall({ w, h }) {
    const cols = [];
    const n = 6;
    for (let i = 0; i < n; i += 1) {
      const cx = 44 + i * ((w - 88) / (n - 1));
      cols.push(`
        <rect x="${cx - 12}" y="112" width="24" height="9" rx="2" fill="#efe4cc"/>
        <rect x="${cx - 9}" y="120" width="18" height="${h - 158}" fill="#fffaf0"/>
        <path d="M${cx - 4} 122 V${h - 40} M${cx + 4} 122 V${h - 40}" stroke="#e6dcc6" stroke-width="2"/>
        <rect x="${cx - 12}" y="${h - 40}" width="24" height="8" rx="2" fill="#efe4cc"/>`);
    }
    return `
      ${shadow(w / 2, h - 4, w / 2 + 8, 20)}
      <rect x="44" y="104" width="${w - 88}" height="${h - 140}" fill="#f6eedd"/>
      <rect x="${w / 2 - 30}" y="140" width="60" height="${h - 172}" rx="4" fill="#5a3f30"/>
      <rect x="${w / 2 - 30}" y="140" width="60" height="${h - 172}" rx="4" fill="none" stroke="#e8b94a" stroke-width="4"/>
      ${useIcon('trophy', w / 2 - 14, 160, 28, '#f0b429')}
      ${cols.join('')}
      <rect x="22" y="${h - 32}" width="${w - 44}" height="10" rx="2" fill="#f1e8d6"/>
      <rect x="10" y="${h - 22}" width="${w - 20}" height="10" rx="2" fill="#e5d9c1"/>
      <rect x="0" y="${h - 12}" width="${w}" height="10" rx="2" fill="#d8caae"/>
      <rect x="10" y="18" width="${w - 20}" height="84" rx="10" fill="#f0b938"/>
      <path d="M10 40 H${w - 10} M10 58 H${w - 10} M10 76 H${w - 10}" stroke="#d99a22" stroke-width="2.4" opacity=".6"/>
      <rect x="10" y="18" width="${w - 20}" height="84" rx="10" fill="url(#w-roof-shine)"/>
      <path d="M14 106 L${w / 2} 44 L${w - 14} 106 Z" fill="#fff7e6" stroke="#e8b94a" stroke-width="5" stroke-linejoin="round"/>
      ${useIcon('rank-up', w / 2 - 22, 66, 44, '#e3a21a')}
      <rect x="14" y="100" width="${w - 28}" height="14" rx="3" fill="#f3e6c9"/>
      <path d="M14 114 H${w - 14}" stroke="#e8b94a" stroke-width="3"/>
      <path d="M${44 + (w - 88) / 5 - 2} 122 v40 l9 -8 l9 8 v-40 Z" fill="#ff5c9d"/>
      <path d="M${w - 44 - (w - 88) / 5 - 16} 122 v40 l9 -8 l9 8 v-40 Z" fill="#ff5c9d"/>`;
  },

  guild({ w, h }) {
    const planks = [];
    for (let x = 30; x < w - 18; x += 16) planks.push(`M${x} 96 V${h - 22}`);
    return `
      ${shadow(w / 2, h - 6, w / 2 + 4, 18)}
      <rect x="16" y="88" width="${w - 32}" height="${h - 96}" rx="5" fill="#ecc998"/>
      <path d="${planks.join(' ')}" stroke="#d3ac78" stroke-width="2"/>
      <rect x="16" y="88" width="${w - 32}" height="${h - 96}" rx="5" fill="url(#w-wall-shade)"/>
      <rect x="16" y="${h - 22}" width="${w - 32}" height="14" rx="4" fill="#b88a58"/>
      ${gableRoof(w, 14, 96, 22, '#3fb07a', '#2c8a5d', '#9fe3be')}
      <rect x="30" y="116" width="94" height="68" rx="5" fill="#9b6a3c"/>
      <rect x="36" y="122" width="82" height="56" rx="3" fill="#c99a61"/>
      <rect x="42" y="128" width="22" height="26" fill="#fff" transform="rotate(-4 53 141)"/>
      <rect x="70" y="126" width="20" height="24" fill="#fff4c7" transform="rotate(3 80 138)"/>
      <rect x="94" y="130" width="18" height="22" fill="#ffd9e6" transform="rotate(-2 103 141)"/>
      <rect x="52" y="152" width="24" height="20" fill="#d9eeff" transform="rotate(2 64 162)"/>
      <rect x="82" y="154" width="22" height="18" fill="#fff" transform="rotate(-3 93 163)"/>
      <circle cx="53" cy="130" r="2.6" fill="#e5484d"/><circle cx="80" cy="128" r="2.6" fill="#e5484d"/>
      <circle cx="103" cy="132" r="2.6" fill="#2f8cff"/><circle cx="64" cy="154" r="2.6" fill="#e5484d"/>
      <circle cx="93" cy="156" r="2.6" fill="#17a35f"/>
      ${archDoor(w - 92, 136, 50, h - 144, '#7a4b2b', '#5a361e')}
      <rect x="${w - 100}" y="104" width="66" height="26" rx="6" fill="#fff8e8" stroke="#2c8a5d" stroke-width="3"/>
      ${useIcon('missions', w - 78, 107, 22, '#2c8a5d')}`;
  },

  shrine({ w, h }) {
    const lattice = [];
    for (let x = 112; x <= 178; x += 11) lattice.push(`M${x} 132 V198`);
    for (let y = 140; y <= 196; y += 11) lattice.push(`M108 ${y} H182`);
    return `
      ${shadow(w / 2, h - 8, w / 2 + 8, 20)}
      <rect x="18" y="${h - 62}" width="${w - 36}" height="42" rx="6" fill="#d9d1c3"/>
      <path d="M18 ${h - 48} H${w - 18} M18 ${h - 34} H${w - 18} M70 ${h - 62} V${h - 20} M130 ${h - 62} V${h - 48} M190 ${h - 48} V${h - 34} M236 ${h - 62} V${h - 20}" stroke="#c7bdac" stroke-width="2"/>
      <rect x="${w / 2 - 34}" y="${h - 24}" width="68" height="8" fill="#cfc6b6"/>
      <rect x="${w / 2 - 40}" y="${h - 16}" width="80" height="8" fill="#c4baa8"/>
      <rect x="${w / 2 - 46}" y="${h - 8}" width="92" height="8" fill="#b9ae9b"/>
      <rect x="46" y="118" width="${w - 92}" height="84" fill="#fffaf1"/>
      <rect x="104" y="128" width="82" height="74" fill="#f2e2bd"/>
      <path d="${lattice.join(' ')}" stroke="#c8a36f" stroke-width="2"/>
      <rect x="46" y="114" width="12" height="90" fill="#d9453b"/><rect x="90" y="114" width="12" height="90" fill="#d9453b"/>
      <rect x="${w - 102}" y="114" width="12" height="90" fill="#d9453b"/><rect x="${w - 58}" y="114" width="12" height="90" fill="#d9453b"/>
      <path d="M94 128 Q145 146 196 128" stroke="#e9cf95" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M100 131 l6 6 M114 136 l6 6 M128 139 l6 6 M142 140 l6 6 M156 139 l6 6 M170 136 l6 6 M184 131 l6 6" stroke="#c9a86a" stroke-width="2.2"/>
      <path d="M118 140 l-4 8 l6 0 l-4 9 M145 143 l-4 8 l6 0 l-4 9 M172 140 l-4 8 l6 0 l-4 9" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round"/>
      <circle cx="145" cy="160" r="9" fill="#f0b429" stroke="#c98a12" stroke-width="2"/>
      <rect x="${w / 2 - 24}" y="${h - 76}" width="48" height="18" rx="2" fill="#8a5a36"/>
      <path d="M${w / 2 - 20} ${h - 70} H${w / 2 + 20} M${w / 2 - 20} ${h - 64} H${w / 2 + 20}" stroke="#5e3b22" stroke-width="2"/>
      <path d="M-6 132 Q34 126 52 98 L86 40 Q145 24 204 40 L238 98 Q256 126 ${w + 6} 132 Q145 108 -6 132 Z" fill="#3e4568"/>
      <path d="M40 112 Q145 92 250 112 M58 86 Q145 68 232 86 M74 62 Q145 46 216 62" stroke="#59618c" stroke-width="3" fill="none"/>
      <path d="M-6 132 Q145 108 ${w + 6} 132" stroke="#e6b84a" stroke-width="4" fill="none"/>
      <path d="M86 38 Q145 22 204 38" stroke="#2a2f4a" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M86 38 l-12 -20 M80 38 l12 -20 M204 38 l-12 -20 M210 38 l12 -20" stroke="#e6b84a" stroke-width="5" stroke-linecap="round"/>
      <rect x="112" y="20" width="16" height="8" rx="4" fill="#e6b84a"/><rect x="137" y="17" width="16" height="8" rx="4" fill="#e6b84a"/><rect x="162" y="20" width="16" height="8" rx="4" fill="#e6b84a"/>`;
  },

  gym({ w, h }) {
    const lanes = [];
    for (let y = 36; y <= 90; y += 13) lanes.push(`M24 ${y} H${w - 24}`);
    return `
      ${shadow(w / 2, h - 6, w / 2 + 8, 20)}
      <rect x="14" y="96" width="${w - 28}" height="${h - 104}" rx="6" fill="#f5f8ff"/>
      <rect x="14" y="96" width="${w - 28}" height="${h - 104}" rx="6" fill="url(#w-wall-shade)"/>
      <rect x="14" y="${h - 20}" width="${w - 28}" height="12" rx="4" fill="#d5dfec"/>
      <rect x="4" y="14" width="${w - 8}" height="90" rx="10" fill="#4a8fe2"/>
      <path d="${lanes.join(' ')}" stroke="#ffffff" stroke-width="2.5" opacity=".55" stroke-dasharray="14 10"/>
      <rect x="22" y="24" width="38" height="24" rx="4" fill="#d9e3ee"/><rect x="26" y="28" width="30" height="16" rx="3" fill="#b9c7d6"/>
      <rect x="${w - 60}" y="24" width="38" height="24" rx="4" fill="#d9e3ee"/><rect x="${w - 56}" y="28" width="30" height="16" rx="3" fill="#b9c7d6"/>
      <rect x="4" y="14" width="${w - 8}" height="90" rx="10" fill="url(#w-roof-shine)"/>
      <path d="M2 104 H${w - 2} L${w - 6} 114 H6 Z" fill="#2f6fbf"/>
      <rect x="${w / 2 - 70}" y="96" width="140" height="28" rx="8" fill="#1d2547"/>
      ${useIcon('stopwatch', w / 2 - 62, 99, 22, '#7ee0a6')}
      <text x="${w / 2 + 12}" y="117" class="w-signtext" fill="#fff" text-anchor="middle">TREINO</text>
      <rect x="28" y="134" width="${w - 56}" height="48" rx="4" fill="#3a6fb8"/>
      <rect x="32" y="138" width="${w - 64}" height="40" rx="2" fill="url(#w-glass)"/>
      <path d="M${32 + (w - 64) / 4} 138 V178 M${32 + (w - 64) / 2} 138 V178 M${32 + 3 * (w - 64) / 4} 138 V178" stroke="#3a6fb8" stroke-width="4"/>
      <path d="M44 172 L64 144 M120 172 L140 144 M196 172 L216 144" stroke="#fff" stroke-width="3" opacity=".5"/>
      <rect x="${w / 2 - 30}" y="186" width="60" height="${h - 194}" rx="3" fill="#3a6fb8"/>
      <rect x="${w / 2 - 26}" y="190" width="25" height="${h - 198}" fill="url(#w-glass)"/>
      <rect x="${w / 2 + 1}" y="190" width="25" height="${h - 198}" fill="url(#w-glass)"/>
      <path d="M26 132 v44 l10 -8 l10 8 v-44 Z" fill="#17a35f"/>
      <path d="M${w - 46} 132 v44 l10 -8 l10 8 v-44 Z" fill="#ff5c9d"/>`;
  },

  house({ w, h }) {
    const shingles = [];
    for (let row = 0; row < 4; row += 1) {
      const y = 34 + row * 16;
      const inset = 24 - row * 5;
      for (let x = inset; x < w - inset - 8; x += 18) {
        shingles.push(`<path d="M${x} ${y} a9 9 0 0 0 18 0" fill="none" stroke="#6f4cc4" stroke-width="2.4" opacity=".7"/>`);
      }
    }
    return `
      ${shadow(w / 2, h - 6, w / 2 + 4, 16)}
      <rect x="26" y="96" width="${w - 52}" height="${h - 104}" rx="6" fill="#fff0f6"/>
      <rect x="26" y="96" width="${w - 52}" height="${h - 104}" rx="6" fill="url(#w-wall-shade)"/>
      <rect x="26" y="${h - 20}" width="${w - 52}" height="12" rx="4" fill="#f0cddd"/>
      <rect x="${w - 70}" y="8" width="24" height="44" rx="3" fill="#c86b5a"/>
      <rect x="${w - 74}" y="4" width="32" height="9" rx="3" fill="#a6513f"/>
      <g class="w-smoke"><circle cx="${w - 58}" cy="-6" r="8"/><circle cx="${w - 52}" cy="-22" r="10"/><circle cx="${w - 60}" cy="-40" r="12"/></g>
      <path d="M8 104 L30 18 H${w - 30} L${w - 8} 104 Z" fill="#9b7af0"/>
      ${shingles.join('')}
      <path d="M8 104 L30 18 H${w - 30} L${w - 8} 104 Z" fill="url(#w-roof-shine)"/>
      <path d="M32 19 H${w - 32}" stroke="#d9ccff" stroke-width="5" stroke-linecap="round"/>
      <path d="M6 104 H${w - 6} L${w - 9} 114 H9 Z" fill="#7552d0"/>
      <circle cx="${w / 2}" cy="64" r="15" fill="#fff"/><circle cx="${w / 2}" cy="64" r="11" fill="url(#w-glow)"/>
      ${windowPane(42, 126, 34, 34, '#e7b6cc', true)}
      ${windowPane(w - 76, 126, 34, 34, '#e7b6cc', true)}
      <rect x="38" y="164" width="42" height="9" rx="3" fill="#5fae5c"/><circle cx="46" cy="164" r="4" fill="#ff7aa8"/><circle cx="58" cy="163" r="4" fill="#ffd34d"/><circle cx="70" cy="164" r="4" fill="#ff7aa8"/>
      <rect x="${w - 80}" y="164" width="42" height="9" rx="3" fill="#5fae5c"/><circle cx="${w - 72}" cy="164" r="4" fill="#ffd34d"/><circle cx="${w - 60}" cy="163" r="4" fill="#ff7aa8"/><circle cx="${w - 48}" cy="164" r="4" fill="#9b7af0"/>
      ${archDoor(w / 2 - 19, 136, 38, h - 144, '#ff7aa8', '#d94f84')}
      <circle cx="${w / 2}" cy="156" r="6" fill="#fff" opacity=".85"/>
      <rect x="${w / 2 - 24}" y="${h - 9}" width="48" height="7" rx="3" fill="#e9b8cc"/>`;
  },

  warehouse({ w, h }) {
    const ribs = [];
    for (let x = 28; x < w - 16; x += 14) ribs.push(`M${x} 22 V108`);
    const front = [];
    for (let x = 30; x < w - 20; x += 12) front.push(`M${x} ${h - 8} V${120 - Math.sqrt(Math.max(0, 1 - ((x - w / 2) / (w / 2 - 16)) ** 2)) * 52}`);
    return `
      ${shadow(w / 2, h - 6, w / 2 + 6, 18)}
      <rect x="12" y="14" width="${w - 24}" height="104" rx="44" fill="#8fa2b2"/>
      <path d="${ribs.join(' ')}" stroke="#7a8d9d" stroke-width="2.4"/>
      <rect x="12" y="14" width="${w - 24}" height="104" rx="44" fill="url(#w-roof-shine)"/>
      <path d="M16 ${h - 8} V128 Q${w / 2} 30 ${w - 16} 128 V${h - 8} Z" fill="#cbd7e1"/>
      <path d="${front.join(' ')}" stroke="#b5c3cf" stroke-width="2"/>
      <path d="M16 128 Q${w / 2} 30 ${w - 16} 128" stroke="#6f8292" stroke-width="5" fill="none"/>
      <rect x="${w / 2 - 54}" y="128" width="108" height="${h - 136}" rx="3" fill="#6d8597"/>
      <path d="M${w / 2 - 54} 128 L${w / 2} ${h - 8} M${w / 2} 128 L${w / 2 - 54} ${h - 8} M${w / 2} 128 L${w / 2 + 54} ${h - 8} M${w / 2 + 54} 128 L${w / 2} ${h - 8}" stroke="#55697a" stroke-width="5"/>
      <path d="M${w / 2} 128 V${h - 8}" stroke="#3f505f" stroke-width="3"/>
      <rect x="${w / 2 - 40}" y="96" width="80" height="24" rx="6" fill="#fff8e8" stroke="#6f8292" stroke-width="3"/>
      ${useIcon('storage', w / 2 - 11, 97, 22, '#b07a2f')}`;
  },

  barn({ w, h }) {
    const boards = [];
    for (let x = 34; x < 240; x += 13) boards.push(`M${x} 110 V${h - 14}`);
    return `
      ${shadow(w / 2, h - 6, w / 2 + 6, 20)}
      <rect x="246" y="58" width="46" height="${h - 66}" rx="10" fill="#c9d2da"/>
      <path d="M246 100 H292 M246 142 H292 M246 184 H292" stroke="#aab5bf" stroke-width="3"/>
      <ellipse cx="269" cy="58" rx="23" ry="16" fill="#9aa8b4"/>
      <rect x="22" y="104" width="214" height="${h - 112}" rx="4" fill="#d9534f"/>
      <path d="${boards.join(' ')}" stroke="#c1443f" stroke-width="2.4"/>
      <rect x="22" y="104" width="214" height="${h - 112}" rx="4" fill="none" stroke="#f7f1e3" stroke-width="5"/>
      <path d="M8 110 L26 54 L64 16 H194 L232 54 L250 110 Z" fill="#a63d39"/>
      <path d="M26 54 H232 M44 34 H214 M14 84 H244" stroke="#8a2f2c" stroke-width="2.4" opacity=".6"/>
      <path d="M8 110 L26 54 L64 16 H194 L232 54 L250 110 Z" fill="url(#w-roof-shine)"/>
      <rect x="107" y="112" width="44" height="34" rx="3" fill="#f7f1e3"/><rect x="112" y="117" width="34" height="24" fill="#e9c45a"/>
      <path d="M114 128 l6 -8 M126 136 l8 -14 M138 132 l5 -9" stroke="#c9a23a" stroke-width="2"/>
      <rect x="88" y="152" width="82" height="${h - 160}" fill="#f7f1e3"/>
      <rect x="94" y="158" width="70" height="${h - 172}" fill="#c1443f"/>
      <path d="M94 158 L164 ${h - 14} M164 158 L94 ${h - 14} M129 158 V${h - 14}" stroke="#f7f1e3" stroke-width="5"/>`;
  },

  // Prédio principal da Academia Tracen: duas alas, bloco central e a torre do relógio.
  academy({ w, h }) {
    const cx = w / 2;
    const wings = [];
    for (const x0 of [30, w - 220]) {
      for (let row = 0; row < 2; row += 1) {
        for (let i = 0; i < 4; i += 1) {
          wings.push(windowPane(x0 + 14 + i * 46, 238 + row * 92, 28, 46, '#d9c3a0', row === 1 && i % 3 === 0));
        }
      }
    }
    const ticks = [];
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      ticks.push(`<path d="M${(cx + Math.sin(a) * 23).toFixed(1)} ${(94 - Math.cos(a) * 23).toFixed(1)} L${(cx + Math.sin(a) * 27).toFixed(1)} ${(94 - Math.cos(a) * 27).toFixed(1)}" stroke="#5a4636" stroke-width="2.4"/>`);
    }
    return `
      ${shadow(cx, h - 8, cx + 14, 24)}
      <rect x="22" y="206" width="${w - 44}" height="${h - 222}" rx="6" fill="#f6ecd9"/>
      <rect x="22" y="206" width="${w - 44}" height="${h - 222}" rx="6" fill="url(#w-wall-shade)"/>
      <path d="M22 322 H${w - 22}" stroke="#e3d3b6" stroke-width="5"/>
      <rect x="22" y="${h - 30}" width="${w - 44}" height="14" rx="4" fill="#dccbab"/>
      <g transform="translate(8 0)">${gableRoof(218, 148, 214, 22, '#2f7d74', '#24605a', '#8fd3c7')}</g>
      <g transform="translate(${w - 226} 0)">${gableRoof(218, 148, 214, 22, '#2f7d74', '#24605a', '#8fd3c7')}</g>
      ${wings.join('')}
      <rect x="${cx - 108}" y="150" width="216" height="${h - 166}" rx="6" fill="#fbf3e3"/>
      <rect x="${cx - 108}" y="150" width="216" height="${h - 166}" rx="6" fill="url(#w-wall-shade)"/>
      <g transform="translate(${cx - 122} 0)">${gableRoof(244, 104, 160, 24, '#2f7d74', '#24605a', '#8fd3c7')}</g>
      <rect x="${cx - 48}" y="40" width="96" height="124" fill="#fbf3e3"/>
      <rect x="${cx - 48}" y="40" width="20" height="124" fill="#fff" opacity=".5"/>
      <path d="M${cx - 60} 48 L${cx} -50 L${cx + 60} 48 Z" fill="#2f7d74"/>
      <path d="M${cx} -50 L${cx + 60} 48 H${cx + 22} Z" fill="#24605a"/>
      <path d="M${cx - 60} 48 L${cx} -50 L${cx + 60} 48 Z" fill="url(#w-roof-shine)"/>
      <path d="M${cx - 64} 48 H${cx + 64}" stroke="#24605a" stroke-width="7" stroke-linecap="round"/>
      <path d="M${cx} -50 V-74" stroke="#c9a86a" stroke-width="4"/><circle cx="${cx}" cy="-52" r="6" fill="#f0b429"/>
      <path class="w-flag" d="M${cx + 2} -74 h26 l-6 7 l6 7 h-26 Z" fill="#ff5c9d" style="transform-origin:${cx + 2}px -74px"/>
      <circle cx="${cx}" cy="94" r="34" fill="#c9a86a"/>
      <circle cx="${cx}" cy="94" r="29" fill="#fffdf6"/>
      ${ticks.join('')}
      <path class="w-clock-h" d="M${cx} 94 V76" stroke="#3a2b20" stroke-width="4" stroke-linecap="round" style="transform-origin:${cx}px 94px"/>
      <path class="w-clock-m" d="M${cx} 94 H${cx + 20}" stroke="#3a2b20" stroke-width="3" stroke-linecap="round" style="transform-origin:${cx}px 94px"/>
      <circle cx="${cx}" cy="94" r="4" fill="#f0b429"/>
      ${windowPane(cx - 92, 186, 30, 48, '#d9c3a0', true)}${windowPane(cx + 62, 186, 30, 48, '#d9c3a0', true)}
      ${windowPane(cx - 92, 262, 30, 40, '#d9c3a0')}${windowPane(cx + 62, 262, 30, 40, '#d9c3a0')}
      <rect x="${cx - 100}" y="${h - 162}" width="200" height="30" rx="9" fill="#fff" stroke="#2f7d74" stroke-width="3"/>
      <text x="${cx}" y="${h - 141}" class="w-signtext small" fill="#24605a" text-anchor="middle">ACADEMIA TRACEN</text>
      <path d="M${cx - 76} ${h - 104} L${cx} ${h - 128} L${cx + 76} ${h - 104} Z" fill="#f1e4c8" stroke="#c9a86a" stroke-width="3" stroke-linejoin="round"/>
      <rect x="${cx - 70}" y="${h - 104}" width="14" height="78" fill="#fffaf0"/><rect x="${cx + 56}" y="${h - 104}" width="14" height="78" fill="#fffaf0"/>
      ${archDoor(cx - 32, h - 96, 64, 70, '#6b4129', '#4e2e1c')}
      <path d="M${cx - 30} ${h - 70} H${cx + 30}" stroke="#f0b429" stroke-width="2" opacity=".6"/>
      <rect x="${cx - 80}" y="${h - 26}" width="160" height="9" rx="2" fill="#efe4cc"/>
      <rect x="${cx - 92}" y="${h - 17}" width="184" height="9" rx="2" fill="#e5d9c1"/>
      <rect x="${cx - 104}" y="${h - 8}" width="208" height="8" rx="2" fill="#d8caae"/>
      <path d="M${cx - 160} 220 v58 l10 -8 l10 8 v-58 Z M${w - 104} 220 v58 l10 -8 l10 8 v-58 Z" fill="#ff5c9d"/>
      <path d="M${cx - 156 + 0} 226 h12 M${w - 100} 226 h12" stroke="#fff" stroke-width="2" opacity=".7"/>`;
  },

  cafe({ w, h }) {
    const stripes = [];
    const n = 11;
    const sw = (w - 36) / n;
    for (let i = 0; i < n; i += 1) {
      const fill = i % 2 ? '#ffffff' : '#f39a3d';
      stripes.push(`<rect x="${18 + i * sw}" y="112" width="${sw + 0.5}" height="20" fill="${fill}"/>`);
      stripes.push(`<circle cx="${18 + i * sw + sw / 2}" cy="132" r="${sw / 2}" fill="${fill}"/>`);
    }
    return `
      ${shadow(w / 2, h - 6, w / 2 + 6, 18)}
      <rect x="${w - 76}" y="8" width="22" height="46" rx="3" fill="#b5654a"/>
      <rect x="${w - 80}" y="4" width="30" height="9" rx="3" fill="#94503a"/>
      <g class="w-smoke"><circle cx="${w - 65}" cy="-8" r="8"/><circle cx="${w - 59}" cy="-24" r="10"/><circle cx="${w - 67}" cy="-42" r="12"/></g>
      <rect x="16" y="92" width="${w - 32}" height="${h - 100}" rx="6" fill="#fff3df"/>
      <rect x="16" y="92" width="${w - 32}" height="${h - 100}" rx="6" fill="url(#w-wall-shade)"/>
      <rect x="16" y="${h - 22}" width="${w - 32}" height="14" rx="4" fill="#ecd3b0"/>
      ${gableRoof(w, 14, 98, 24, '#f08a3c', '#c96a24', '#ffd3a8')}
      <rect x="${w / 2 - 86}" y="32" width="172" height="36" rx="12" fill="#fff" stroke="#c96a24" stroke-width="3"/>
      ${useIcon('carrot', w / 2 - 78, 38, 24, '#e2731c')}
      <text x="${w / 2 + 14}" y="57" class="w-signtext small" fill="#b4561a" text-anchor="middle">REFEITÓRIO</text>
      ${stripes.join('')}
      ${windowPane(30, 152, 66, 42, '#d9b48c', true)}
      ${windowPane(w - 96, 152, 66, 42, '#d9b48c', true)}
      <ellipse cx="48" cy="188" rx="9" ry="4" fill="#fff"/><ellipse cx="68" cy="188" rx="9" ry="4" fill="#fff"/><circle cx="48" cy="185" r="4" fill="#ff9f43"/><circle cx="68" cy="185" r="4" fill="#7bd36b"/>
      <ellipse cx="${w - 78}" cy="188" rx="9" ry="4" fill="#fff"/><ellipse cx="${w - 58}" cy="188" rx="9" ry="4" fill="#fff"/><circle cx="${w - 78}" cy="185" r="4" fill="#ffd34d"/><circle cx="${w - 58}" cy="185" r="4" fill="#ff7aa8"/>
      ${archDoor(w / 2 - 22, 146, 44, h - 154, '#a0643a', '#7b4c2f')}
      <rect x="${w / 2 - 34}" y="${h - 10}" width="68" height="7" rx="3" fill="#e7cfae"/>`;
  },

  dorm({ w, h }) {
    const wins = [];
    const curtains = ['#ffb3cd', '#b9d6ff', '#ffe08a', '#c8f0c0'];
    for (let row = 0; row < 2; row += 1) {
      for (let i = 0; i < 7; i += 1) {
        if (row === 1 && i === 3) continue; // a porta fica aqui
        const x = 36 + i * 58;
        const y = 114 + row * 74;
        wins.push(windowPane(x, y, 36, 40, '#d6b48f', row === 0 && i % 3 === 1));
        wins.push(`<path d="M${x} ${y} h10 l-4 40 h-6 Z M${x + 36} ${y} h-10 l4 40 h6 Z" fill="${curtains[(i + row) % 4]}" opacity=".92"/>`);
        if (row === 0) {
          wins.push(`<rect x="${x - 4}" y="${y + 42}" width="44" height="8" rx="2" fill="#5fae5c"/>
            <circle cx="${x + 6}" cy="${y + 42}" r="3.5" fill="#ff7aa8"/><circle cx="${x + 20}" cy="${y + 41}" r="3.5" fill="#ffd34d"/><circle cx="${x + 32}" cy="${y + 42}" r="3.5" fill="#fff"/>`);
        }
      }
    }
    return `
      ${shadow(w / 2, h - 6, w / 2 + 8, 20)}
      <rect x="16" y="96" width="${w - 32}" height="${h - 104}" rx="6" fill="#fdf6ec"/>
      <rect x="16" y="96" width="${w - 32}" height="${h - 104}" rx="6" fill="url(#w-wall-shade)"/>
      <path d="M16 176 H${w - 16}" stroke="#ead9c0" stroke-width="5"/>
      <rect x="16" y="${h - 22}" width="${w - 32}" height="14" rx="4" fill="#e5d3b8"/>
      ${gableRoof(w, 16, 100, 26, '#c8553d', '#9e3f2c', '#f2a48f')}
      <rect x="${w / 2 - 96}" y="34" width="192" height="34" rx="12" fill="#fff" stroke="#9e3f2c" stroke-width="3"/>
      ${useIcon('home', w / 2 - 86, 39, 24, '#c8553d')}
      <text x="${w / 2 + 14}" y="58" class="w-signtext small" fill="#9e3f2c" text-anchor="middle">DORMITÓRIO</text>
      ${wins.join('')}
      <path d="M${w / 2 - 46} 192 H${w / 2 + 46} L${w / 2 + 36} 176 H${w / 2 - 36} Z" fill="#c8553d"/>
      ${archDoor(w / 2 - 24, 196, 48, h - 204, '#7a4b2b', '#5a361e')}
      <rect x="${w / 2 - 36}" y="${h - 10}" width="72" height="7" rx="3" fill="#dccab0"/>`;
  },

  gazebo({ w, h }) {
    const cx = w / 2;
    const pillars = [34, 86, 154, 206].map((x) => `
      <rect x="${x - 6}" y="98" width="12" height="${h - 122}" rx="3" fill="#fffaf2"/>
      <rect x="${x - 6}" y="98" width="4" height="${h - 122}" fill="#fff" opacity=".8"/>`).join('');
    const scallops = [];
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8;
      scallops.push(`<circle cx="${(-4 + t * (w + 8)).toFixed(1)}" cy="${(112 - 44 * t * (1 - t)).toFixed(1)}" r="7" fill="#fff"/>`);
    }
    return `
      ${shadow(cx, h - 10, cx + 6, 22)}
      <ellipse cx="${cx}" cy="${h - 22}" rx="${cx - 6}" ry="26" fill="#e3d6c2"/>
      <ellipse cx="${cx}" cy="${h - 28}" rx="${cx - 10}" ry="24" fill="#f3e9da"/>
      <rect x="${cx - 30}" y="${h - 14}" width="60" height="10" rx="3" fill="#d9cab2"/>
      <rect x="${cx - 3}" y="${h - 50}" width="6" height="20" fill="#d8c3a5"/>
      <ellipse cx="${cx}" cy="${h - 50}" rx="30" ry="9" fill="#fff"/>
      <circle cx="${cx - 12}" cy="${h - 55}" r="5" fill="#f497b8"/><rect x="${cx + 4}" y="${h - 61}" width="10" height="8" rx="2" fill="#fff" stroke="#c9a86a" stroke-width="1.5"/>
      ${pillars}
      <path d="M-4 104 Q${cx} 80 ${w + 4} 104 L${w - 18} 74 L${cx} 16 L18 74 Z" fill="#7fd1b9"/>
      <path d="M${cx} 16 L${cx - 44} 96 M${cx} 16 L${cx + 44} 96 M${cx} 16 V92" stroke="#68c2a8" stroke-width="3"/>
      <path d="M-4 104 Q${cx} 80 ${w + 4} 104 L${w + 4} 110 Q${cx} 88 -4 110 Z" fill="#fff"/>
      ${scallops.join('')}
      <path d="M-4 104 Q${cx} 80 ${w + 4} 104 L${w - 18} 74 L${cx} 16 L18 74 Z" fill="url(#w-roof-shine)"/>
      <circle cx="${cx}" cy="12" r="7" fill="#f0b429"/>
      <path d="M40 116 v14 M200 116 v14" stroke="#8b5e3c" stroke-width="2"/>
      <circle cx="40" cy="136" r="10" fill="#5fae5c"/><circle cx="35" cy="133" r="3" fill="#ff7aa8"/><circle cx="45" cy="138" r="3" fill="#ffd34d"/>
      <circle cx="200" cy="136" r="10" fill="#5fae5c"/><circle cx="195" cy="138" r="3" fill="#fff"/><circle cx="205" cy="133" r="3" fill="#ff7aa8"/>`;
  },

  clubroom({ w, h }) {
    const siding = [];
    for (let y = 84; y < h - 14; y += 10) siding.push(`M16 ${y} H${w - 16}`);
    return `
      ${shadow(w / 2, h - 6, w / 2 + 4, 16)}
      <rect x="14" y="70" width="${w - 28}" height="${h - 78}" rx="4" fill="#d6e6f3"/>
      <path d="${siding.join(' ')}" stroke="#bfd3e4" stroke-width="2"/>
      <rect x="14" y="70" width="${w - 28}" height="${h - 78}" rx="4" fill="url(#w-wall-shade)"/>
      <rect x="4" y="54" width="${w - 8}" height="22" rx="5" fill="#3a5f8f"/>
      <rect x="4" y="54" width="${w - 8}" height="8" rx="4" fill="#5b82b5"/>
      <rect x="${w / 2 - 60}" y="16" width="120" height="32" rx="10" fill="#fff" stroke="#3a5f8f" stroke-width="3"/>
      <rect x="${w / 2 - 52}" y="46" width="6" height="10" fill="#3a5f8f"/><rect x="${w / 2 + 46}" y="46" width="6" height="10" fill="#3a5f8f"/>
      ${useIcon('trophy', w / 2 - 52, 21, 22, '#e3a21a')}
      <text x="${w / 2 + 12}" y="38" class="w-signtext small" fill="#3a5f8f" text-anchor="middle">CLUBE</text>
      ${windowPane(26, 92, 50, 38, '#9fb7cc')}
      ${windowPane(w - 76, 92, 50, 38, '#9fb7cc', true)}
      <path d="M${w - 68} 126 v-12 h8 v12 Z M${w - 55} 126 v-18 h8 v18 Z M${w - 42} 126 v-9 h8 v9 Z" fill="#f0b429"/>
      ${archDoor(w / 2 - 21, 88, 42, h - 96, '#ff7aa8', '#d94f84')}
      <rect x="${w / 2 - 30}" y="${h - 10}" width="60" height="7" rx="3" fill="#c9d6e2"/>
      <rect x="${w - 20}" y="-14" width="5" height="84" fill="#8b9bb0"/>
      <path class="w-flag" d="M${w - 15} -10 h28 l-6 9 l6 9 h-28 Z" fill="#17a35f" style="transform-origin:${w - 15}px -10px"/>`;
  },

  // Arquibancada da pista: fica de frente para a reta, com a torcida colorida.
  grandstand({ w, h }) {
    const rand = mulberry32(11);
    const colors = ['#ff7aa8', '#ffd34d', '#7ab8ff', '#7ee0a6', '#ffffff', '#ff9f43', '#9b7af0', '#e5484d'];
    const crowd = [];
    for (let row = 0; row < 5; row += 1) {
      const y = 66 + row * 18;
      for (let x = 26; x < w - 26; x += 11 + rand() * 7) {
        if (rand() < 0.25) continue;
        crowd.push(`<circle cx="${x.toFixed(0)}" cy="${(y + rand() * 3).toFixed(1)}" r="4.4" fill="${colors[Math.floor(rand() * colors.length)]}"/>`);
      }
    }
    const pillars = [];
    for (let x = 44; x < w - 20; x += 128) pillars.push(`<rect x="${x}" y="30" width="8" height="${h - 50}" fill="#c9d3dc"/>`);
    return `
      ${shadow(w / 2, h - 4, w / 2 + 10, 14)}
      <rect x="10" y="40" width="${w - 20}" height="${h - 52}" fill="#5b6b7c"/>
      ${[0, 1, 2, 3, 4].map((r) => `<rect x="14" y="${58 + r * 18}" width="${w - 28}" height="18" fill="${r % 2 ? '#e9eef3' : '#dfe6ec'}"/>`).join('')}
      ${crowd.join('')}
      ${[0.25, 0.5, 0.75].map((f) => `<rect x="${w * f - 10}" y="58" width="20" height="90" fill="#cfd8e0"/>`).join('')}
      ${pillars.join('')}
      <path d="M0 36 L22 4 H${w - 22} L${w} 36 Z" fill="#ffffff"/>
      <path d="M0 36 L22 4 H${w - 22} L${w} 36 Z" fill="url(#w-roof-shine)"/>
      <path d="M0 36 H${w}" stroke="#2f7d74" stroke-width="6"/>
      <path d="M22 5 H${w - 22}" stroke="#d9e2ea" stroke-width="3"/>
      <rect x="10" y="${h - 24}" width="${w - 20}" height="20" fill="#2f7d74"/>
      <rect x="${w / 2 - 112}" y="${h - 34}" width="224" height="32" rx="9" fill="#fff" stroke="#2f7d74" stroke-width="3"/>
      <text x="${w / 2}" y="${h - 11}" class="w-signtext" fill="#2f7d74" text-anchor="middle">PISTA TRACEN</text>`;
  },
};

// ------------------------------------------------------------------ objetos

const PROP_ART = {
  tree({ variant = 'green' }) {
    const tones = {
      green: ['#4caf5a', '#5fc06a', '#86d888'],
      deep: ['#3f9a52', '#4fae5f', '#77cf80'],
      sakura: ['#f497b8', '#ffb3cd', '#ffd5e4'],
    }[variant];
    return svg(150, 176, `
      ${shadow(75, 166, 56, 13)}
      <path d="M68 168 Q70 128 66 106 H84 Q80 128 82 168 Z" fill="#8b5e3c"/>
      <circle cx="44" cy="92" r="40" fill="${tones[0]}"/>
      <circle cx="106" cy="92" r="40" fill="${tones[0]}"/>
      <circle cx="75" cy="58" r="50" fill="${tones[1]}"/>
      <circle cx="58" cy="44" r="20" fill="${tones[2]}" opacity=".8"/>
      <circle cx="96" cy="98" r="26" fill="${tones[1]}"/>
      ${variant === 'sakura' ? '<circle cx="40" cy="70" r="4" fill="#fff"/><circle cx="104" cy="52" r="3.5" fill="#fff"/><circle cx="84" cy="96" r="3" fill="#fff"/><circle cx="60" cy="100" r="3.5" fill="#fff"/>' : ''}`);
  },

  bush({ variant = 'green' }) {
    const c = variant === 'flower' ? ['#58b45f', '#ff8fb6'] : ['#58b45f', '#7fd07f'];
    return svg(80, 54, `
      ${shadow(40, 48, 36, 8)}
      <circle cx="24" cy="32" r="18" fill="${c[0]}"/><circle cx="56" cy="32" r="18" fill="${c[0]}"/><circle cx="40" cy="22" r="20" fill="${c[1] === '#7fd07f' ? '#6cc46f' : '#6cc46f'}"/>
      ${variant === 'flower' ? '<circle cx="26" cy="24" r="4" fill="#ff8fb6"/><circle cx="46" cy="16" r="4" fill="#fff"/><circle cx="58" cy="28" r="4" fill="#ffd34d"/><circle cx="36" cy="34" r="3.5" fill="#ff8fb6"/>' : '<circle cx="34" cy="16" r="8" fill="#9be09a" opacity=".7"/>'}`);
  },

  fountain() {
    return svg(232, 176, `
      ${shadow(116, 150, 112, 24)}
      <ellipse cx="116" cy="118" rx="108" ry="54" fill="#cfc6b6"/>
      <ellipse cx="116" cy="112" rx="108" ry="54" fill="#e2dbcd"/>
      <ellipse cx="116" cy="112" rx="94" ry="44" fill="url(#w-water)"/>
      <ellipse cx="96" cy="104" rx="30" ry="8" fill="#fff" opacity=".35"/>
      <ellipse cx="140" cy="122" rx="20" ry="5" fill="#fff" opacity=".3"/>
      <rect x="104" y="56" width="24" height="58" rx="6" fill="#e7e0d3"/>
      <ellipse cx="116" cy="58" rx="40" ry="14" fill="#d6cebf"/>
      <ellipse cx="116" cy="55" rx="40" ry="14" fill="#e9e2d6"/>
      <ellipse cx="116" cy="55" rx="30" ry="9" fill="url(#w-water)"/>
      <g class="w-spray">
        <path d="M116 50 Q100 18 84 46" stroke="#bfe9fb" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M116 50 Q132 18 148 46" stroke="#bfe9fb" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M116 50 V20" stroke="#dff5ff" stroke-width="5" stroke-linecap="round"/>
      </g>
      <circle class="w-drop d1" cx="86" cy="80" r="3" fill="#dff5ff"/>
      <circle class="w-drop d2" cx="146" cy="82" r="3" fill="#dff5ff"/>`);
  },

  board() {
    return svg(124, 118, `
      ${shadow(62, 112, 50, 9)}
      <rect x="16" y="40" width="9" height="74" fill="#7a4b2b"/><rect x="99" y="40" width="9" height="74" fill="#7a4b2b"/>
      <rect x="6" y="26" width="112" height="70" rx="5" fill="#9b6a3c"/>
      <rect x="12" y="32" width="100" height="58" rx="3" fill="#d8ae78"/>
      <path d="M0 30 L62 6 L124 30 Z" fill="#3fb07a"/><path d="M0 30 L62 6 L124 30" stroke="#2c8a5d" stroke-width="4" fill="none"/>
      <rect x="20" y="38" width="26" height="30" fill="#fff" transform="rotate(-4 33 53)"/>
      <rect x="52" y="36" width="24" height="22" fill="#fff4c7" transform="rotate(3 64 47)"/>
      <rect x="82" y="40" width="22" height="28" fill="#ffd9e6" transform="rotate(-3 93 54)"/>
      <rect x="54" y="62" width="30" height="22" fill="#d9eeff"/>
      <circle cx="33" cy="40" r="3" fill="#e5484d"/><circle cx="64" cy="38" r="3" fill="#2f8cff"/><circle cx="93" cy="42" r="3" fill="#e5484d"/><circle cx="69" cy="64" r="3" fill="#17a35f"/>`);
  },

  lamp() {
    return svg(30, 118, `
      ${shadow(15, 112, 12, 4)}
      <rect x="12" y="24" width="6" height="90" rx="2" fill="#2f4b3a"/>
      <rect x="8" y="108" width="14" height="8" rx="2" fill="#2f4b3a"/>
      <rect x="5" y="8" width="20" height="20" rx="4" fill="#2f4b3a"/>
      <rect x="8" y="11" width="14" height="14" rx="3" fill="url(#w-glow)"/>
      <path d="M3 9 L15 0 L27 9 Z" fill="#2f4b3a"/>`);
  },

  bench() {
    return svg(96, 52, `
      ${shadow(48, 48, 44, 6)}
      <rect x="10" y="30" width="6" height="18" fill="#6b4a32"/><rect x="80" y="30" width="6" height="18" fill="#6b4a32"/>
      <rect x="4" y="6" width="88" height="9" rx="3" fill="#b77d4a"/>
      <rect x="4" y="18" width="88" height="9" rx="3" fill="#c98d57"/>
      <rect x="2" y="29" width="92" height="9" rx="3" fill="#d9a066"/>`);
  },

  torii() {
    return svg(176, 156, `
      ${shadow(88, 150, 80, 8, 0.7)}
      <rect x="24" y="30" width="16" height="122" fill="#e0473d"/><rect x="136" y="30" width="16" height="122" fill="#e0473d"/>
      <rect x="21" y="140" width="22" height="12" fill="#2b2b38"/><rect x="133" y="140" width="22" height="12" fill="#2b2b38"/>
      <rect x="10" y="56" width="156" height="12" fill="#e0473d"/>
      <rect x="8" y="30" width="160" height="12" fill="#e0473d"/>
      <path d="M0 22 Q88 8 176 22 L170 36 Q88 24 6 36 Z" fill="#2b2b38"/>
      <rect x="78" y="36" width="20" height="24" fill="#2b2b38"/><rect x="81" y="39" width="14" height="18" fill="none" stroke="#e6b84a" stroke-width="2"/>`, 'w-torii');
  },

  lantern() {
    return svg(44, 78, `
      ${shadow(22, 74, 18, 5)}
      <rect x="12" y="62" width="20" height="12" rx="2" fill="#a8a196"/>
      <rect x="18" y="38" width="8" height="26" fill="#bdb6aa"/>
      <rect x="8" y="22" width="28" height="18" rx="2" fill="#c9c2b6"/>
      <rect x="14" y="26" width="16" height="10" rx="1" fill="url(#w-glow)"/>
      <path d="M2 24 L22 8 L42 24 Z" fill="#a8a196"/><circle cx="22" cy="7" r="4" fill="#a8a196"/>`);
  },

  nobori({ color = '#ff5c9d' }) {
    return svg(40, 128, `
      ${shadow(10, 124, 10, 4)}
      <rect x="7" y="0" width="5" height="126" rx="2" fill="#6b4a32"/>
      <g class="w-flag"><path d="M12 8 H36 V100 L24 92 L12 100 Z" fill="${color}"/>
      <path d="M12 8 H36 V16 H12 Z" fill="#fff" opacity=".6"/>
      <circle cx="24" cy="40" r="7" fill="#fff" opacity=".9"/><circle cx="24" cy="62" r="4" fill="#fff" opacity=".7"/><circle cx="24" cy="76" r="4" fill="#fff" opacity=".7"/></g>`);
  },

  gate() {
    return svg(210, 128, `
      ${shadow(105, 124, 98, 7, 0.6)}
      <rect x="14" y="20" width="16" height="104" fill="#8b5e3c"/><rect x="180" y="20" width="16" height="104" fill="#8b5e3c"/>
      <path d="M4 26 Q105 -6 206 26" stroke="#6b4a32" stroke-width="12" fill="none" stroke-linecap="round"/>
      <rect x="54" y="8" width="102" height="30" rx="8" fill="#fff6dc" stroke="#8b5e3c" stroke-width="4"/>
      ${useIcon('wheat', 62, 12, 22, '#d99a22')}
      <text x="117" y="30" class="w-signtext small" fill="#8b5e3c" text-anchor="middle">FAZENDA</text>
      <circle cx="22" cy="20" r="6" fill="#ffd34d"/><circle cx="188" cy="20" r="6" fill="#ffd34d"/>`);
  },

  crates() {
    return svg(96, 74, `
      ${shadow(48, 68, 44, 8)}
      <rect x="4" y="30" width="40" height="38" rx="3" fill="#c98d57"/><path d="M4 30 L44 68 M44 30 L4 68" stroke="#a46a3a" stroke-width="4"/>
      <rect x="4" y="30" width="40" height="38" rx="3" fill="none" stroke="#a46a3a" stroke-width="4"/>
      <rect x="40" y="4" width="34" height="32" rx="3" fill="#d9a066"/><path d="M40 20 H74" stroke="#a46a3a" stroke-width="4"/>
      <rect x="40" y="4" width="34" height="32" rx="3" fill="none" stroke="#a46a3a" stroke-width="4"/>
      <rect x="52" y="34" width="38" height="36" rx="16" fill="#9a6440"/><path d="M52 44 H90 M52 60 H90" stroke="#6d4429" stroke-width="3"/>`);
  },

  mailbox() {
    return svg(36, 70, `
      ${shadow(18, 66, 14, 4)}
      <rect x="15" y="30" width="6" height="38" fill="#6b4a32"/>
      <rect x="4" y="8" width="28" height="24" rx="10" fill="#ff5c9d"/>
      <rect x="28" y="4" width="3" height="16" fill="#e5484d"/><rect x="28" y="4" width="9" height="6" fill="#e5484d"/>`);
  },

  haystack() {
    return svg(80, 60, `
      ${shadow(40, 54, 36, 7)}
      <path d="M6 52 Q8 10 40 6 Q72 10 74 52 Z" fill="#e9c45a"/>
      <path d="M20 46 Q22 24 34 16 M46 48 Q48 26 58 18 M30 50 Q34 34 40 28" stroke="#c9a23a" stroke-width="2.4" fill="none"/>`);
  },

  bleachers() {
    return svg(170, 80, `
      ${shadow(85, 76, 82, 7)}
      <rect x="6" y="50" width="158" height="22" fill="#d5dfec"/>
      <rect x="6" y="34" width="158" height="16" fill="#e2eaf4"/>
      <rect x="6" y="18" width="158" height="16" fill="#eef3fa"/>
      <path d="M6 50 H164 M6 34 H164" stroke="#b9c7d6" stroke-width="2"/>
      <rect x="0" y="4" width="170" height="14" rx="4" fill="#4a8fe2"/>
      <circle cx="30" cy="28" r="5" fill="#ff7aa8"/><circle cx="62" cy="44" r="5" fill="#ffd34d"/><circle cx="120" cy="28" r="5" fill="#7ee0a6"/>`);
  },

  // Fonte das Três Deusas, o símbolo da Academia, no centro da Praça.
  goddess() {
    // Estátuas de mármore com contorno e sombra, para cada deusa se destacar da outra.
    const figure = (x, top, scale, arms) => {
      const arm = (side) => `
        <path d="M${side * 5} 20 Q${side * 14} 6 ${side * 17} -14" stroke="#b9ad96" stroke-width="8.6" stroke-linecap="round" fill="none"/>
        <path d="M${side * 5} 20 Q${side * 14} 6 ${side * 17} -14" stroke="#f4efe5" stroke-width="5.4" stroke-linecap="round" fill="none"/>`;
      return `
        <g transform="translate(${x} ${top}) scale(${scale})">
          <path d="M-10 6 Q-15 30 -11 40 M10 6 Q15 30 11 40" stroke="#b9ad96" stroke-width="8" fill="none" stroke-linecap="round"/>
          <path d="M-10 6 Q-15 30 -11 40 M10 6 Q15 30 11 40" stroke="#e6ddca" stroke-width="5" fill="none" stroke-linecap="round"/>
          <path d="M-15 74 Q-17 34 -8 17 Q0 9 8 17 Q17 34 15 74 Z" fill="#f7f3ea" stroke="#b9ad96" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M-14 72 Q-16 34 -8 18 L-3 21 Q-9 44 -8 72 Z" fill="#e2d9c6"/>
          <path d="M-1 24 Q-5 48 -9 72 M5 26 Q7 48 9 72 M-12 52 Q0 58 12 52" stroke="#d6ccb7" stroke-width="2" fill="none"/>
          <circle cx="0" cy="7" r="9" fill="#f7f3ea" stroke="#b9ad96" stroke-width="1.8"/>
          <path d="M-10 6 Q-9 -6 0 -5 Q9 -6 10 6 Q6 -1 0 0 Q-6 -1 -10 6 Z" fill="#ddd2bd"/>
          ${arms.map(arm).join('')}
        </g>`;
    };
    return svg(300, 260, `
      ${shadow(150, 230, 146, 30)}
      <ellipse cx="150" cy="208" rx="140" ry="58" fill="#cfc6b6"/>
      <ellipse cx="150" cy="200" rx="140" ry="58" fill="#e2dbcd"/>
      <ellipse cx="150" cy="200" rx="124" ry="47" fill="url(#w-water)"/>
      <ellipse cx="112" cy="190" rx="38" ry="9" fill="#fff" opacity=".35"/>
      <ellipse cx="192" cy="214" rx="24" ry="6" fill="#fff" opacity=".3"/>
      <rect x="126" y="112" width="48" height="92" rx="8" fill="#e7e0d3"/>
      <rect x="126" y="112" width="14" height="92" rx="6" fill="#f3eee4"/>
      <ellipse cx="150" cy="114" rx="46" ry="14" fill="#d6cebf"/>
      <ellipse cx="150" cy="111" rx="46" ry="14" fill="#ece6da"/>
      <ellipse cx="150" cy="106" rx="40" ry="9" fill="#cfc5b1" opacity=".7"/>
      ${figure(150, 32, 1.04, [-1, 1])}
      ${figure(117, 44, 0.94, [1])}
      ${figure(183, 44, 0.94, [-1])}
      <ellipse cx="150" cy="24" rx="32" ry="10" fill="none" stroke="#e3a21a" stroke-width="7"/>
      <ellipse cx="150" cy="22" rx="32" ry="10" fill="none" stroke="#ffd34d" stroke-width="4"/>
      <circle cx="150" cy="22" r="6" fill="#fff6c8"/>
      <circle class="w-drop d1" cx="108" cy="150" r="3" fill="#dff5ff"/><circle class="w-drop d2" cx="192" cy="152" r="3" fill="#dff5ff"/>
      <path class="w-spray" d="M128 150 Q100 120 86 168 M172 150 Q200 120 214 168" stroke="#bfe9fb" stroke-width="4" fill="none" stroke-linecap="round" style="transform-origin:150px 150px"/>`);
  },

  flowerbed({ w, h = 46, variant = 'pink' }) {
    const tones = {
      pink: ['#ff7aa8', '#ffc2d6'], yellow: ['#ffd34d', '#fff1a6'], blue: ['#6aa8ff', '#cfe2ff'], red: ['#ef5350', '#ffd0c8'],
    }[variant] || ['#ff7aa8', '#ffc2d6'];
    const rand = mulberry32(Math.round(w * 7) + variant.length);
    const leaves = [];
    const flowers = [];
    for (let x = 12; x < w - 10; x += 9) leaves.push(`<circle cx="${x}" cy="${(20 + rand() * 6).toFixed(1)}" r="${(6 + rand() * 2).toFixed(1)}" fill="${rand() > 0.5 ? '#5fae5c' : '#6cc46f'}"/>`);
    for (let x = 13; x < w - 12; x += 10) flowers.push(`<circle cx="${(x + rand() * 4).toFixed(1)}" cy="${(14 + rand() * 12).toFixed(1)}" r="${(2.8 + rand() * 1.6).toFixed(1)}" fill="${tones[rand() > 0.35 ? 0 : 1]}"/>`);
    return svg(w, h, `
      ${shadow(w / 2, h - 3, w / 2, 6)}
      <rect x="2" y="24" width="${w - 4}" height="${h - 28}" rx="6" fill="#b58a5c"/>
      <rect x="2" y="24" width="${w - 4}" height="5" rx="2.5" fill="#cfa577"/>
      <rect x="7" y="20" width="${w - 14}" height="10" rx="5" fill="#7a5233"/>
      ${leaves.join('')}${flowers.join('')}`);
  },

  omikuji() {
    const papers = [];
    for (let i = 0; i < 9; i += 1) {
      const x = 12 + i * 5.4;
      papers.push(`<rect x="${x.toFixed(1)}" y="${30 + (i % 2) * 3}" width="4" height="10" rx="1" fill="#fff" transform="rotate(${(i % 3) * 8 - 8} ${(x + 2).toFixed(1)} 32)"/>`);
      papers.push(`<rect x="${(x + 2).toFixed(1)}" y="${54 + (i % 3) * 2}" width="4" height="10" rx="1" fill="#fff" transform="rotate(${(i % 2) * 10 - 5} ${(x + 4).toFixed(1)} 56)"/>`);
    }
    return svg(70, 92, `
      ${shadow(35, 88, 32, 5)}
      <rect x="8" y="14" width="6" height="76" fill="#8b5e3c"/><rect x="56" y="14" width="6" height="76" fill="#8b5e3c"/>
      <rect x="2" y="8" width="66" height="8" rx="2" fill="#6b4a32"/>
      <path d="M8 32 H62 M8 56 H62" stroke="#a27650" stroke-width="3"/>
      ${papers.join('')}
      <rect x="22" y="72" width="26" height="16" rx="2" fill="#d9453b"/><path d="M26 78 H44" stroke="#f0d28a" stroke-width="2"/>`);
  },

  parasol({ variant = 'pink' }) {
    const c = variant === 'mint' ? '#46c6a0' : '#ff7aa8';
    const wedges = [];
    for (let i = 0; i < 6; i += 1) {
      const x0 = 6 + i * 18;
      wedges.push(`<path d="M60 10 L${x0} 50 Q${x0 + 9} 57 ${x0 + 18} 50 Z" fill="${i % 2 ? '#fff' : c}"/>`);
    }
    return svg(120, 132, `
      ${shadow(60, 124, 52, 9)}
      <rect x="14" y="96" width="16" height="24" rx="5" fill="#f3e3c9"/><rect x="90" y="96" width="16" height="24" rx="5" fill="#f3e3c9"/>
      <rect x="57" y="40" width="6" height="64" fill="#8b9bb0"/>
      <rect x="57" y="104" width="6" height="18" fill="#b9c4cf"/>
      <ellipse cx="60" cy="104" rx="32" ry="11" fill="#e9e2d6"/><ellipse cx="60" cy="101" rx="32" ry="10" fill="#fdfaf4"/>
      <circle cx="49" cy="99" r="6" fill="#ffd34d"/><circle cx="68" cy="100" r="5" fill="#ff9f43"/><rect x="57" y="92" width="8" height="8" rx="2" fill="#fff" stroke="#c9a86a"/>
      ${wedges.join('')}
      <path d="M6 50 Q60 36 114 50" stroke="#000" stroke-opacity=".08" stroke-width="3" fill="none"/>
      <circle cx="60" cy="8" r="4" fill="#8b9bb0"/>`);
  },

  menu() {
    return svg(54, 70, `
      ${shadow(27, 66, 24, 4)}
      <path d="M8 66 L17 8 H37 L46 66" stroke="#8b5e3c" stroke-width="4" fill="none"/>
      <rect x="10" y="10" width="34" height="40" rx="3" fill="#2f4b3a" stroke="#8b5e3c" stroke-width="3"/>
      <path d="M15 20 H31 M15 28 H38 M15 36 H29 M15 44 H36" stroke="#fff" stroke-width="2" opacity=".8" stroke-linecap="round"/>
      <circle cx="38" cy="19" r="3" fill="#ff9f43"/>`);
  },

  vending() {
    const colors = ['#e5484d', '#2f8cff', '#ffd34d', '#17a35f', '#ff7aa8', '#9b7af0'];
    const cans = [];
    for (let r = 0; r < 3; r += 1) {
      for (let i = 0; i < 4; i += 1) cans.push(`<rect x="${12 + i * 8}" y="${20 + r * 14}" width="6" height="10" rx="2" fill="${colors[(r * 4 + i) % colors.length]}"/>`);
    }
    return svg(60, 100, `
      ${shadow(30, 96, 28, 5)}
      <rect x="4" y="6" width="52" height="90" rx="5" fill="#2f6fbf"/>
      <rect x="4" y="6" width="52" height="10" rx="5" fill="#4a8fe2"/>
      <rect x="9" y="16" width="34" height="46" rx="3" fill="#e2f1ff"/>
      ${cans.join('')}
      <rect x="45" y="20" width="7" height="30" rx="2" fill="#d9e3ee"/>
      <rect x="10" y="70" width="32" height="12" rx="2" fill="#1d2547"/>`);
  },

  flagpole() {
    return svg(70, 210, `
      ${shadow(10, 206, 14, 4)}
      <rect x="7" y="4" width="6" height="204" rx="2" fill="#c9d3dc"/>
      <circle cx="10" cy="4" r="5" fill="#f0b429"/>
      <g class="w-flag" style="transform-origin:13px 12px">
        <path d="M13 12 H66 V52 H13 Z" fill="#17a35f"/>
        <path d="M13 12 H66 V19 H13 Z" fill="#fff" opacity=".35"/>
        <path d="M31 42 V30 a9 9 0 0 1 18 0 V42 h-5 V30 a4 4 0 0 0 -8 0 V42 Z" fill="#fff"/>
      </g>`);
  },

  tires() {
    const tire = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="22" ry="10" fill="#2b2b38"/><ellipse cx="${x}" cy="${y - 5}" rx="22" ry="10" fill="#3d3d4f"/><ellipse cx="${x}" cy="${y - 5}" rx="10" ry="4.5" fill="#1d1d26"/>`;
    return svg(120, 70, `${shadow(60, 64, 56, 7)}${tire(28, 62)}${tire(76, 62)}${tire(100, 54)}${tire(52, 48)}`);
  },

  hurdle() {
    return svg(90, 64, `
      ${shadow(45, 60, 42, 5)}
      <rect x="9" y="18" width="6" height="44" fill="#fff"/><rect x="75" y="18" width="6" height="44" fill="#fff"/>
      <rect x="4" y="56" width="16" height="6" rx="2" fill="#c9d3dc"/><rect x="70" y="56" width="16" height="6" rx="2" fill="#c9d3dc"/>
      <rect x="4" y="16" width="82" height="13" rx="3" fill="#fff"/>
      ${[12, 32, 52, 72].map((x) => `<rect x="${x}" y="16" width="10" height="13" fill="#e5484d"/>`).join('')}`);
  },

  cones() {
    const cone = (x) => `<path d="M${x - 12} 40 L${x} 6 L${x + 12} 40 Z" fill="#ff8a2a"/>
      <path d="M${x - 8} 28 L${x + 8} 28 L${x + 6} 21 L${x - 6} 21 Z" fill="#fff"/>
      <rect x="${x - 15}" y="38" width="30" height="5" rx="2" fill="#e5701c"/>`;
    return svg(110, 44, `${shadow(55, 41, 50, 4)}${cone(18)}${cone(55)}${cone(92)}`);
  },

  labtable() {
    return svg(110, 84, `
      ${shadow(55, 80, 52, 6)}
      <rect x="10" y="46" width="6" height="34" fill="#8b9bb0"/><rect x="94" y="46" width="6" height="34" fill="#8b9bb0"/>
      <rect x="2" y="40" width="106" height="10" rx="3" fill="#e9eef3"/>
      <path d="M20 40 V24 h8 V40 Z" fill="#cfe9ff"/><path d="M18 40 Q24 31 30 40 Z" fill="#7ee0a6"/>
      <path d="M44 40 L48 18 h8 l4 22 Z" fill="#e2f6ff"/><path d="M45 40 L47 30 h10 l2 10 Z" fill="#ff7aa8"/>
      <circle cx="80" cy="30" r="10" fill="#e2f6ff"/><rect x="77" y="12" width="6" height="12" fill="#e2f6ff"/>
      <path d="M71 31 a9 7 0 0 0 18 0 Z" fill="#ffd34d"/>
      <circle class="w-bubble b1" cx="52" cy="14" r="2.5" fill="#ffc2d6"/><circle class="w-bubble b2" cx="80" cy="8" r="2.5" fill="#fff1a6"/>`);
  },

  // Vara de pesca da Gold Ship: a linha cai dentro do lago.
  fishing() {
    return svg(120, 110, `
      <path d="M112 46 Q60 0 6 8" stroke="#6b4a32" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M6 8 Q2 52 12 90" stroke="#fff" stroke-width="1.4" fill="none" opacity=".9"/>
      <g class="w-bob"><circle cx="12" cy="92" r="5" fill="#e5484d"/><path d="M7 92 h10" stroke="#fff" stroke-width="2"/></g>
      <path d="M0 100 q12 -6 24 0" stroke="#fff" stroke-opacity=".6" stroke-width="2" fill="none"/>
      ${shadow(97, 107, 18, 4)}
      <path d="M84 84 h26 l-3 22 h-20 Z" fill="#8fa2b2"/><ellipse cx="97" cy="84" rx="13" ry="4" fill="#5a6b7a"/>
      <path d="M92 82 l4 -10 l4 10" fill="#4fb3e2"/>`);
  },

  reeds() {
    return svg(70, 60, `
      <path d="M14 58 Q12 30 18 8 M28 58 Q30 26 26 4 M42 58 Q44 34 48 12 M56 58 Q54 36 58 20" stroke="#4f8f3a" stroke-width="3" fill="none"/>
      <rect x="15" y="8" width="6" height="16" rx="3" fill="#8b5e3c"/><rect x="23" y="4" width="6" height="16" rx="3" fill="#8b5e3c"/>
      <rect x="45" y="12" width="6" height="14" rx="3" fill="#8b5e3c"/>
      <path d="M8 58 Q20 40 30 58 M36 58 Q50 44 62 58" fill="#6cc46f"/>`);
  },

  scarecrow() {
    return svg(70, 110, `
      ${shadow(35, 106, 20, 4)}
      <rect x="32" y="30" width="6" height="78" fill="#8b5e3c"/>
      <rect x="4" y="44" width="62" height="6" rx="3" fill="#8b5e3c"/>
      <path d="M20 46 H50 L46 80 H24 Z" fill="#4a8fe2"/><path d="M28 56 h14 v8 h-14 Z" fill="#ffd34d"/>
      <circle cx="35" cy="28" r="13" fill="#f2e2b6"/>
      <circle cx="30" cy="27" r="2" fill="#1d2547"/><circle cx="40" cy="27" r="2" fill="#1d2547"/>
      <path d="M30 33 q5 4 10 0" stroke="#1d2547" stroke-width="1.6" fill="none"/>
      <path d="M16 18 L35 4 L54 18 Z" fill="#e9c45a"/><rect x="18" y="15" width="34" height="5" rx="2" fill="#c9a23a"/>
      <path d="M4 44 l-2 8 M66 44 l2 8" stroke="#e9c45a" stroke-width="3"/>`);
  },

  signpost() {
    return svg(90, 110, `
      ${shadow(45, 106, 14, 4)}
      <rect x="42" y="10" width="6" height="98" fill="#8b5e3c"/>
      <path d="M48 18 H82 L88 26 L82 34 H48 Z" fill="#ff7aa8"/>
      <path d="M42 40 H10 L4 48 L10 56 H42 Z" fill="#7ab8ff"/>
      <path d="M48 62 H78 L84 70 L78 78 H48 Z" fill="#7ee0a6"/>
      <path d="M56 26 H76 M14 48 H36 M56 70 H72" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="45" cy="9" r="5" fill="#f0b429"/>`);
  },

  bikes() {
    const bike = (x, color) => `
      <circle cx="${x}" cy="52" r="12" fill="none" stroke="#3a3a4a" stroke-width="3.5"/>
      <circle cx="${x + 36}" cy="52" r="12" fill="none" stroke="#3a3a4a" stroke-width="3.5"/>
      <path d="M${x} 52 L${x + 14} 34 H${x + 30} L${x + 36} 52 M${x + 14} 34 L${x + 18} 52 L${x + 30} 34" stroke="${color}" stroke-width="3.5" fill="none" stroke-linejoin="round"/>
      <path d="M${x + 10} 30 h10 M${x + 28} 28 l4 -4 h6" stroke="#3a3a4a" stroke-width="3" stroke-linecap="round"/>`;
    return svg(120, 70, `
      ${shadow(60, 66, 56, 6)}
      <rect x="6" y="58" width="108" height="5" rx="2.5" fill="#9aa8b4"/>
      ${bike(8, '#ff7aa8')}${bike(64, '#4a8fe2')}`);
  },

  teatable() {
    return svg(96, 70, `
      ${shadow(48, 66, 42, 6)}
      <rect x="45" y="40" width="6" height="26" fill="#d8c3a5"/>
      <ellipse cx="48" cy="40" rx="40" ry="13" fill="#efe6da"/><ellipse cx="48" cy="38" rx="40" ry="12" fill="#fdf6ee"/>
      <path d="M22 38 q0 -12 10 -12 q10 0 10 12 Z" fill="#fff" stroke="#e7b6cc" stroke-width="2"/><path d="M42 30 l6 -4" stroke="#e7b6cc" stroke-width="2"/>
      <rect x="56" y="12" width="3" height="26" fill="#c9a86a"/>
      <ellipse cx="57" cy="36" rx="12" ry="3" fill="#f3e3c9"/><ellipse cx="57" cy="26" rx="9" ry="2.5" fill="#f3e3c9"/><ellipse cx="57" cy="17" rx="6" ry="2" fill="#f3e3c9"/>
      <circle cx="52" cy="33" r="3" fill="#ff7aa8"/><circle cx="62" cy="33" r="3" fill="#ffd34d"/><circle cx="55" cy="23" r="2.5" fill="#9b7af0"/><circle cx="58" cy="14" r="2" fill="#ff7aa8"/>
      <ellipse cx="80" cy="38" rx="7" ry="3" fill="#fff" stroke="#e7b6cc" stroke-width="1.5"/>`);
  },

  whiteboard() {
    return svg(110, 74, `
      ${shadow(55, 70, 50, 5)}
      <path d="M14 70 L20 20 M96 70 L90 20" stroke="#8b9bb0" stroke-width="4"/>
      <rect x="6" y="6" width="98" height="46" rx="4" fill="#fff" stroke="#8b9bb0" stroke-width="3"/>
      <ellipse cx="55" cy="29" rx="34" ry="14" fill="none" stroke="#2f8cff" stroke-width="2"/>
      <path d="M30 22 l6 6 M36 22 l-6 6" stroke="#e5484d" stroke-width="2.4"/>
      <circle cx="72" cy="34" r="3" fill="none" stroke="#e5484d" stroke-width="2.4"/>
      <path d="M38 36 Q55 20 70 31" stroke="#17a35f" stroke-width="2" fill="none" stroke-dasharray="4 3"/>`);
  },

  binoculars() {
    return svg(46, 76, `
      ${shadow(23, 72, 16, 4)}
      <rect x="20" y="34" width="6" height="38" fill="#5b6b7c"/>
      <rect x="12" y="66" width="22" height="6" rx="2" fill="#5b6b7c"/>
      <rect x="6" y="14" width="34" height="22" rx="8" fill="#3a8f6a"/>
      <circle cx="14" cy="14" r="8" fill="#2c6e51"/><circle cx="32" cy="14" r="8" fill="#2c6e51"/>
      <circle cx="14" cy="14" r="4.5" fill="url(#w-glass)"/><circle cx="32" cy="14" r="4.5" fill="url(#w-glass)"/>`);
  },

  finishpost() {
    return svg(40, 120, `
      ${shadow(20, 116, 12, 3)}
      <rect x="17" y="32" width="6" height="86" fill="#fff"/>
      <path d="M17 52 h6 M17 72 h6 M17 92 h6" stroke="#e5484d" stroke-width="6"/>
      <circle cx="20" cy="20" r="18" fill="#fff" stroke="#e5484d" stroke-width="5"/>
      <circle cx="20" cy="20" r="6" fill="#e5484d"/>`);
  },

  startgate() {
    const stalls = [];
    for (let i = 0; i < 8; i += 1) {
      const x = 14 + i * 24;
      stalls.push(`<rect x="${x}" y="40" width="20" height="92" fill="#2e7d4f"/><rect x="${x + 3}" y="70" width="14" height="56" fill="#dff0e5"/><path d="M${x + 3} 98 h14" stroke="#2e7d4f" stroke-width="3"/>`);
    }
    return svg(220, 150, `
      ${shadow(110, 144, 106, 8)}
      <rect x="6" y="20" width="208" height="120" rx="4" fill="#3d9b63"/>
      ${stalls.join('')}
      <rect x="2" y="12" width="216" height="26" rx="5" fill="#2e7d4f"/>
      ${stalls.map((_, i) => `<text x="${24 + i * 24}" y="31" class="w-gatenum" text-anchor="middle" fill="#fff">${i + 1}</text>`).join('')}`);
  },
};

export function buildingSvg(b, extra = {}) {
  return svg(b.w, b.h, BUILDING_ART[b.kind]({ ...b, ...extra }), `w-building k-${b.kind}`);
}

export function propSvg(p) {
  return PROP_ART[p.kind](p);
}

// ------------------------------------------------------------------ chão

function fieldRows() {
  const out = [];
  const { x, y, w, h } = FIELD;
  const mid = x + w / 2;
  for (let ry = y + 24; ry < y + h - 16; ry += 26) {
    out.push(`<path d="M${x + 20} ${ry} H${mid - 60}" stroke="#9c6f42" stroke-width="10" stroke-linecap="round"/>`);
    out.push(`<path d="M${mid + 60} ${ry} H${x + w - 20}" stroke="#9c6f42" stroke-width="10" stroke-linecap="round"/>`);
    for (let cx = x + 30; cx < mid - 60; cx += 22) {
      out.push(`<path d="M${cx} ${ry - 3} l-4 -12 M${cx} ${ry - 3} l0 -15 M${cx} ${ry - 3} l4 -12" stroke="#e2b443" stroke-width="3" stroke-linecap="round"/>`);
    }
    for (let cx = mid + 70; cx < x + w - 20; cx += 24) {
      out.push(`<path d="M${cx} ${ry - 4} l-5 -10 M${cx} ${ry - 4} l0 -13 M${cx} ${ry - 4} l5 -10" stroke="#4fae5f" stroke-width="3.4" stroke-linecap="round"/><circle cx="${cx}" cy="${ry - 1}" r="3.4" fill="#f08a2a"/>`);
    }
  }
  return out.join('');
}

function fence() {
  const { x, y, w, h } = FIELD;
  const gateL = x + w / 2 - 70;
  const gateR = x + w / 2 + 70;
  const posts = [];
  const line = (x1, y1, x2, y2) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.round(len / 46));
    for (let i = 0; i <= n; i += 1) {
      const px = x1 + ((x2 - x1) * i) / n;
      const py = y1 + ((y2 - y1) * i) / n;
      posts.push(`<rect x="${px - 4}" y="${py - 22}" width="8" height="24" rx="2" fill="#a5754a"/>`);
    }
    return `<path d="M${x1} ${y1 - 16} L${x2} ${y2 - 16} M${x1} ${y1 - 6} L${x2} ${y2 - 6}" stroke="#c39566" stroke-width="5" stroke-linecap="round"/>`;
  };
  return [
    line(x, y, gateL, y), line(gateR, y, x + w, y), line(x, y, x, y + h), line(x + w, y, x + w, y + h),
    line(x, y + h, x + w, y + h), posts.join(''),
  ].join('');
}

function borderForest() {
  const blobs = [];
  const rand = mulberry32(7);
  const add = (cx, cy) => {
    const r = 46 + rand() * 30;
    blobs.push(`<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${rand() > 0.5 ? '#3f9a52' : '#4caf5a'}"/>`);
    blobs.push(`<circle cx="${(cx - r * 0.3).toFixed(0)}" cy="${(cy - r * 0.35).toFixed(0)}" r="${(r * 0.45).toFixed(0)}" fill="#6cc476" opacity=".55"/>`);
  };
  for (let x = -20; x < WORLD.w + 40; x += 62) { add(x, 40 + rand() * 90); add(x + 30, WORLD.h - 30 - rand() * 50); }
  for (let y = 120; y < WORLD.h - 60; y += 62) { add(30 + rand() * 70, y); add(WORLD.w - 30 - rand() * 60, y + 30); }
  return blobs.join('');
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function flowerRing() {
  const out = [];
  const { x, y, r } = PLAZA;
  const rand = mulberry32(3);
  const colors = ['#ff7aa8', '#ffd34d', '#ffffff', '#9b7af0', '#ff9f43'];
  for (let a = 0; a < Math.PI * 2; a += 0.075) {
    const gap = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].some((g) => Math.abs(((a - g + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.32);
    if (gap) continue;
    const rr = r + 16 + rand() * 10;
    out.push(`<circle cx="${(x + Math.cos(a) * rr).toFixed(1)}" cy="${(y + Math.sin(a) * rr * 0.98).toFixed(1)}" r="${(3 + rand() * 2.5).toFixed(1)}" fill="${colors[Math.floor(rand() * colors.length)]}"/>`);
  }
  return out.join('');
}

/** Contorno da pista deslocado `off` px da linha que separa a grama (fora) da areia (dentro). */
export function trackOutline(off = 0) {
  return stadium(off);
}

function stadium(off) {
  const { cx, cy, hs } = TRACK;
  const a = TRACK.rx + off;
  const b = TRACK.ry + off;
  return `M${cx + hs} ${cy - b} H${cx - hs} A${a} ${b} 0 0 0 ${cx - hs} ${cy + b} H${cx + hs} A${a} ${b} 0 0 0 ${cx + hs} ${cy - b} Z`;
}

function racecourse() {
  const T = TRACK;
  const posts = [];
  // Marcos de distância na cerca de dentro, ao longo das retas.
  for (let i = 0, x = T.cx - T.hs + 150; x <= T.cx + T.hs - 150; i += 1, x += 300) {
    for (const y of [T.cy - T.ry + T.dirt, T.cy + T.ry - T.dirt]) {
      posts.push(`<rect x="${x - 4}" y="${y - 20}" width="8" height="22" rx="2" fill="${i % 2 ? '#2f8cff' : '#e5484d'}"/><rect x="${x - 4}" y="${y - 20}" width="8" height="7" rx="2" fill="#fff"/>`);
    }
  }
  return `
    <path d="${stadium(T.turf + 30)}" fill="#86c860"/>
    <path d="${stadium(T.turf)}" fill="#4caa48"/>
    <path d="${stadium(T.turf / 2)}" fill="none" stroke="#5cba55" stroke-width="${T.turf - 20}" stroke-dasharray="80 80"/>
    <path d="${stadium(0)}" fill="#d6a468"/>
    <path d="${stadium(-T.dirt / 2)}" fill="none" stroke="#c4915a" stroke-width="2.5" stroke-dasharray="30 16"/>
    <path d="${stadium(-T.dirt / 2 - 18)}" fill="none" stroke="#e6bd85" stroke-width="2" stroke-dasharray="16 26"/>
    <path d="${stadium(-T.dirt / 2 + 18)}" fill="none" stroke="#e6bd85" stroke-width="2" stroke-dasharray="22 20"/>
    <path d="${stadium(-T.dirt)}" fill="url(#w-infield)"/>
    ${infield()}
    <path d="${stadium(T.turf)}" fill="none" stroke="#fff" stroke-width="7"/>
    <path d="${stadium(T.turf + 8)}" fill="none" stroke="#2f7d74" stroke-width="2" stroke-dasharray="3 22"/>
    <path d="${stadium(0)}" fill="none" stroke="#fff" stroke-width="4"/>
    <path d="${stadium(-T.dirt)}" fill="none" stroke="#fff" stroke-width="6"/>
    ${posts.join('')}
    <rect x="2696" y="${T.cy - T.ry - T.turf}" width="8" height="${T.turf + T.dirt}" fill="#fff" opacity=".92"/>`;
}

function infield() {
  const T = TRACK;
  const pond = { x: T.cx - 640, y: T.cy + 8, rx: 240, ry: 72 };
  const rand = mulberry32(21);
  const colors = ['#ff7aa8', '#ffd34d', '#ffffff', '#9b7af0', '#ff9f43'];
  const flowers = [];
  for (let x = T.cx - T.hs + 40; x < T.cx + T.hs - 40; x += 24) {
    if (Math.abs(x - pond.x) < pond.rx + 50 || Math.abs(x - T.cx) < 250) continue;
    for (const dy of [-118, 118]) {
      flowers.push(`<circle cx="${x + (rand() * 6).toFixed(1)}" cy="${(T.cy + dy + rand() * 8).toFixed(1)}" r="${(3 + rand() * 2.5).toFixed(1)}" fill="${colors[Math.floor(rand() * colors.length)]}"/>`);
    }
  }
  return `
    <ellipse cx="${T.cx}" cy="${T.cy + 30}" rx="330" ry="80" fill="#a7df82" opacity=".6"/>
    <ellipse cx="${pond.x}" cy="${pond.y + 6}" rx="${pond.rx + 16}" ry="${pond.ry + 12}" fill="#86c25f"/>
    <ellipse cx="${pond.x}" cy="${pond.y}" rx="${pond.rx + 6}" ry="${pond.ry + 6}" fill="#cbb98f"/>
    <ellipse cx="${pond.x}" cy="${pond.y}" rx="${pond.rx}" ry="${pond.ry}" fill="url(#w-water)"/>
    <g class="w-ripples" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round">
      <path d="M${pond.x - 130} ${pond.y - 12} q20 -8 40 0"/><path d="M${pond.x + 50} ${pond.y + 22} q24 -8 48 0"/>
    </g>
    <ellipse cx="${pond.x + 120}" cy="${pond.y - 24}" rx="16" ry="9" fill="#5fae5c"/><circle cx="${pond.x + 122}" cy="${pond.y - 28}" r="5" fill="#ff8fb6"/>
    <ellipse cx="${T.cx + 640}" cy="${T.cy}" rx="230" ry="62" fill="#a7df82" opacity=".7"/>
    <path d="M${T.cx + 470} ${T.cy} H${T.cx + 810}" stroke="#bfe89f" stroke-width="26" stroke-linecap="round"/>
    ${flowers.join('')}`;
}

/** Bandeirinhas presas na cerca de fora da reta principal. */
function bunting() {
  const y = TRACK.cy - TRACK.ry - TRACK.turf - 16;
  const x0 = TRACK.cx - TRACK.hs;
  const colors = ['#ff7aa8', '#ffd34d', '#7ab8ff', '#7ee0a6'];
  const flags = [];
  for (let i = 0, x = x0 + 10; x < 2270; i += 1, x += 30) flags.push(`<path d="M${x} ${y} h18 l-9 14 Z" fill="${colors[i % 4]}"/>`);
  return `<path d="M${x0} ${y} H2280" stroke="#8b9bb0" stroke-width="2"/>${flags.join('')}`;
}

/** Mirante: plataforma de pedra no fim do eixo central, de frente para a pista. */
function terrace() {
  const { x, y, rx, ry } = TERRACE;
  const base = BOUNDS.y1 + 20;
  return `
    <path d="M${x - rx - 14} ${base} V${y} A${rx + 14} ${ry + 14} 0 0 1 ${x + rx + 14} ${y} V${base} Z" fill="#d6c9b1"/>
    <path d="M${x - rx} ${base} V${y} A${rx} ${ry} 0 0 1 ${x + rx} ${y} V${base} Z" fill="url(#w-stone)"/>
    <path d="M${x - rx + 70} ${y} A${rx - 70} ${ry - 40} 0 0 1 ${x + rx - 70} ${y}" fill="none" stroke="#e2d6bf" stroke-width="12"/>
    <path d="M${x - rx + 70} ${y} A${rx - 70} ${ry - 40} 0 0 1 ${x + rx - 70} ${y}" fill="none" stroke="#f6efe2" stroke-width="4"/>
    <circle cx="${x}" cy="${y - 34}" r="26" fill="#e2d6bf"/><circle cx="${x}" cy="${y - 34}" r="18" fill="#f6efe2"/>
    <path d="M${x - 10} ${y - 30} l10 -14 l10 14" stroke="#c9a86a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Cerca do limite sul (um objeto próprio, para ficar na frente de quem encosta nela). */
export function southFenceSvg() {
  const y = 40;
  const w = WORLD.w;
  const t0 = TERRACE.x - TERRACE.rx;
  const t1 = TERRACE.x + TERRACE.rx;
  const run = (x1, x2) => {
    const posts = [];
    for (let x = x1; x <= x2; x += 42) posts.push(`<rect x="${x - 4}" y="${y - 26}" width="8" height="30" rx="2" fill="#fff"/><rect x="${x - 4}" y="${y - 26}" width="8" height="5" rx="2" fill="#e7e2d8"/>`);
    return `<path d="M${x1} ${y - 19} H${x2} M${x1} ${y - 8} H${x2}" stroke="#f4f1ea" stroke-width="5"/>${posts.join('')}`;
  };
  const balusters = [];
  for (let x = t0; x <= t1; x += 18) balusters.push(`<rect x="${x - 4}" y="${y - 24}" width="8" height="24" rx="3" fill="#ece6da"/>`);
  return `<svg class="w-art" width="${w}" height="${y + 10}" viewBox="0 0 ${w} ${y + 10}" overflow="visible">
    ${run(BOUNDS.x0 - 20, t0 - 14)}${run(t1 + 14, BOUNDS.x1 + 20)}
    <rect x="${t0}" y="${y - 6}" width="${t1 - t0}" height="10" rx="3" fill="#d6cebf"/>
    ${balusters.join('')}
    <rect x="${t0 - 8}" y="${y - 32}" width="${t1 - t0 + 16}" height="11" rx="5" fill="#f3eee4"/>
    <rect x="${t0 - 8}" y="${y - 32}" width="${t1 - t0 + 16}" height="4" rx="2" fill="#fff"/>
  </svg>`;
}

function hedge() {
  const y = BOUNDS.y1 + 52;
  const rand = mulberry32(5);
  const out = [];
  for (let x = 130; x < WORLD.w - 120; x += 34) {
    out.push(`<circle cx="${x}" cy="${(y + rand() * 6).toFixed(1)}" r="${(22 + rand() * 6).toFixed(1)}" fill="${rand() > 0.5 ? '#4caf5a' : '#58b45f'}"/>`);
  }
  return out.join('');
}

export function groundSvg() {
  const { w, h } = WORLD;
  const P = PLAZA;
  return `
  <svg class="world-ground" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <defs>
      <radialGradient id="w-shadow"><stop offset="0" stop-color="#1c2f14" stop-opacity=".34"/><stop offset="1" stop-color="#1c2f14" stop-opacity="0"/></radialGradient>
      <pattern id="w-grass" width="96" height="96" patternUnits="userSpaceOnUse">
        <rect width="96" height="96" fill="#a2d878"/>
        <g fill="none" stroke="#8cc663" stroke-width="2.6" stroke-linecap="round">
          <path d="M14 26l3-9 3 9"/><path d="M60 70l3-9 3 9"/><path d="M76 20l2-7 2 7"/><path d="M30 84l2-7 2 7"/><path d="M44 46l2-6 2 6"/>
        </g>
        <g fill="#c2e8a1"><circle cx="40" cy="20" r="2.2"/><circle cx="10" cy="60" r="1.8"/><circle cx="84" cy="48" r="2"/><circle cx="64" cy="90" r="1.6"/></g>
      </pattern>
      <pattern id="w-stone" width="60" height="44" patternUnits="userSpaceOnUse">
        <rect width="60" height="44" fill="#efe7d7"/>
        <path d="M0 22H60M30 0V22M0 44H60M15 22V44M45 22V44" stroke="#ddd1ba" stroke-width="2.2"/>
      </pattern>
      <pattern id="w-sand" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#f2e2b6"/>
        <circle cx="8" cy="10" r="1.8" fill="#e2cd97"/><circle cx="28" cy="26" r="2.2" fill="#e2cd97"/><circle cx="20" cy="4" r="1.2" fill="#fff4d6"/><circle cx="34" cy="8" r="1.4" fill="#e2cd97"/>
      </pattern>
      <linearGradient id="w-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fdcf5"/><stop offset="1" stop-color="#4fb3e2"/></linearGradient>
      <linearGradient id="w-roof-shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="w-wall-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".07"/></linearGradient>
      <linearGradient id="w-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2f6ff"/><stop offset=".55" stop-color="#a5daf6"/><stop offset="1" stop-color="#7cc0ea"/></linearGradient>
      <linearGradient id="w-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7d0"/><stop offset="1" stop-color="#ffd66b"/></linearGradient>
      <pattern id="w-checker" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#fff"/><rect width="6" height="6" fill="#1d2547"/><rect x="6" y="6" width="6" height="6" fill="#1d2547"/></pattern>
      <linearGradient id="w-infield" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8ccf68"/><stop offset=".5" stop-color="#9ad874"/><stop offset="1" stop-color="#8ccf68"/></linearGradient>
    </defs>

    <rect width="${w}" height="${h}" fill="url(#w-grass)"/>
    <ellipse cx="1180" cy="1010" rx="300" ry="120" fill="#b5e48c" opacity=".45"/>
    <ellipse cx="2400" cy="1300" rx="320" ry="130" fill="#b5e48c" opacity=".4"/>
    <ellipse cx="1800" cy="1750" rx="420" ry="200" fill="#b5e48c" opacity=".35"/>
    <ellipse cx="3150" cy="1000" rx="260" ry="120" fill="#93cf6c" opacity=".35"/>
    <ellipse cx="560" cy="2000" rx="300" ry="120" fill="#93cf6c" opacity=".3"/>
    <ellipse cx="2950" cy="1900" rx="300" ry="130" fill="#b5e48c" opacity=".4"/>
    <rect x="0" y="${BOUNDS.y1 + 30}" width="${w}" height="${h - BOUNDS.y1 - 30}" fill="#8fcb68" opacity=".45"/>
    ${racecourse()}
    ${bunting()}
    ${hedge()}

    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="${PATHS}" stroke="#d9c08a" stroke-width="92"/>
      <path d="${PATHS}" stroke="url(#w-sand)" stroke-width="76"/>
    </g>

    <circle cx="${P.x}" cy="${P.y}" r="${P.r + 12}" fill="#d6c9b1"/>
    <circle cx="${P.x}" cy="${P.y}" r="${P.r}" fill="url(#w-stone)"/>
    <circle cx="${P.x}" cy="${P.y}" r="${P.r - 60}" fill="none" stroke="#e2d6bf" stroke-width="16"/>
    <circle cx="${P.x}" cy="${P.y}" r="${P.r - 60}" fill="none" stroke="#f6efe2" stroke-width="5"/>
    <g opacity=".9">${flowerRing()}</g>

    <ellipse cx="${POND.x}" cy="${POND.y + 6}" rx="${POND.rx + 16}" ry="${POND.ry + 14}" fill="#86c25f"/>
    <ellipse cx="${POND.x}" cy="${POND.y}" rx="${POND.rx + 8}" ry="${POND.ry + 8}" fill="#cbb98f"/>
    <ellipse cx="${POND.x}" cy="${POND.y}" rx="${POND.rx}" ry="${POND.ry}" fill="url(#w-water)"/>
    <g class="w-ripples" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round">
      <path d="M${POND.x - 90} ${POND.y - 20} q20 -8 40 0"/><path d="M${POND.x + 30} ${POND.y + 30} q24 -8 48 0"/><path d="M${POND.x - 30} ${POND.y + 46} q16 -6 32 0"/>
    </g>
    <g fill="#5fae5c"><ellipse cx="${POND.x - 110}" cy="${POND.y + 30}" rx="18" ry="10"/><ellipse cx="${POND.x + 90}" cy="${POND.y - 40}" rx="16" ry="9"/><ellipse cx="${POND.x + 120}" cy="${POND.y + 20}" rx="14" ry="8"/></g>
    <circle cx="${POND.x + 92}" cy="${POND.y - 44}" r="5" fill="#ff8fb6"/>
    <g class="w-duck" transform="translate(${POND.x - 20} ${POND.y - 10})"><ellipse rx="16" ry="10" fill="#fff"/><circle cx="12" cy="-10" r="8" fill="#fff"/><path d="M19 -10 l9 2 l-9 3 Z" fill="#ff9f43"/><circle cx="14" cy="-12" r="1.6" fill="#1d2547"/></g>
    <g class="w-duck d2" transform="translate(${POND.x + 40} ${POND.y + 16})"><ellipse rx="12" ry="8" fill="#ffd34d"/><circle cx="9" cy="-8" r="6" fill="#ffd34d"/><path d="M14 -8 l7 1.5 l-7 2.5 Z" fill="#ff9f43"/></g>

    ${terrace()}

    <rect x="${FIELD.x - 10}" y="${FIELD.y - 4}" width="${FIELD.w + 20}" height="${FIELD.h + 14}" rx="22" fill="#9bcf72"/>
    <rect x="${FIELD.x}" y="${FIELD.y}" width="${FIELD.w}" height="${FIELD.h}" rx="16" fill="#b8875a"/>
    ${fieldRows()}
    <path d="M${FIELD.x + FIELD.w / 2} ${FIELD.y} V${FIELD.y + 150}" stroke="#d8b98a" stroke-width="80"/>
    ${fence()}

    <g>${borderForest()}</g>
  </svg>`;
}
