// O mundo: a Academia Tracen em visão de cima, com a sua corredora andando por ela.
// Entrar num prédio abre a tela da área; ao voltar, a corredora reaparece na porta.

import { api, onState, state } from '../store.js';
import { live, subscribe } from '../realtime.js';
import {
  BOUNDS, BUILDINGS, DECOR_BUILDINGS, FIELD, NPCS, PATHS, PLAZA, POND, PROPS, RUNNERS, SCREEN, SPAWN, TRACK, UMAS, WORLD,
  doorExit, trackPoint,
} from '../world/layout.js';
import { buildingSvg, groundSvg, propSvg, southFenceSvg, trackOutline } from '../world/art.js';
import { WorldEngine } from '../world/engine.js';
import {
  act, charCard, esc, fmt, formatFeed, icon, kbd, openModal, portrait, toast, umaImg,
} from '../ui.js';

const ROUTE_TO_BUILDING = Object.fromEntries(BUILDINGS.map((b) => [b.route, b]));
const PRACA_SPOT = { x: 2010, y: 1000 };
const MINIMAP_KEY = 'umaworld.minimap';

let lastPosition = null; // onde a corredora estava quando saiu do mundo
let cameFrom = null;     // última área visitada (para reaparecer na porta certa)

/** Chamado pelo roteador a cada navegação. */
export function noteRoute(previous) {
  if (previous && previous !== 'mundo' && previous !== 'mapa') cameFrom = previous;
}

function startPosition() {
  const from = cameFrom;
  cameFrom = null;
  if (from === 'praca') return PRACA_SPOT;
  if (from && ROUTE_TO_BUILDING[from]) return doorExit(ROUTE_TO_BUILDING[from]);
  return lastPosition || SPAWN;
}

function spriteFor(id, npc = false) {
  return umaImg(npc ? `npc_${id}` : id, 'sprite');
}

function walkerHtml({ sprite, color, name, sub = '', cls = '', entity = '', id = '', at = null }) {
  const pos = at ? `style="transform:translate3d(${at.x}px, ${at.y}px, 0);z-index:${Math.round(at.y)}"` : '';
  return `<div class="walker ${cls}" ${entity ? `data-entity="${entity}"` : ''} ${id ? `data-id="${esc(id)}"` : ''} ${pos}>
    <span class="walker-shadow"></span>
    <span class="walker-body" style="--c:${esc(color || '#7c8aa5')}">
      <img class="walker-sprite" src="${sprite}" alt="" draggable="false" onerror="this.parentNode.classList.add('nosprite')">
    </span>
    <span class="walker-tag">${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>
    <span class="walker-emote" hidden></span>
    <span class="walker-bubble" hidden></span>
  </div>`;
}

/** Minimapa: o mundo inteiro em miniatura. O ponto verde é você; o retângulo, o que a tela mostra. */
function minimapSvg() {
  const tone = { pink: '#ff5c9d', gold: '#f0a500', green: '#17a35f', sky: '#2f8cff', purple: '#8f62f0', ink: '#3b4466' };
  const block = (b, fill) => `<rect x="${b.x}" y="${b.y + b.h * 0.3}" width="${b.w}" height="${b.h * 0.7}" rx="26" fill="${fill}">
    <title>${esc(b.label || '')}</title></rect>`;
  return `<svg viewBox="0 0 ${WORLD.w} ${WORLD.h}" role="img" aria-label="Minimapa da Academia">
    <rect width="${WORLD.w}" height="${WORLD.h}" fill="#a8db7f"/>
    <rect y="${BOUNDS.y1 + 30}" width="${WORLD.w}" height="${WORLD.h - BOUNDS.y1 - 30}" fill="#8fcb68"/>
    <path d="${trackOutline(TRACK.turf / 2 - TRACK.dirt / 2)}" fill="none" stroke="#d6a468" stroke-width="${TRACK.turf + TRACK.dirt}"/>
    <path d="${trackOutline(TRACK.turf / 2)}" fill="none" stroke="#4caa48" stroke-width="${TRACK.turf}"/>
    <path d="${PATHS}" fill="none" stroke="#f3e2b3" stroke-width="80" stroke-linecap="round"/>
    <circle cx="${PLAZA.x}" cy="${PLAZA.y}" r="${PLAZA.r}" fill="#efe7d7"/>
    <ellipse cx="${POND.x}" cy="${POND.y}" rx="${POND.rx}" ry="${POND.ry}" fill="#58bde8"/>
    <rect x="${FIELD.x}" y="${FIELD.y}" width="${FIELD.w}" height="${FIELD.h}" rx="30" fill="#c49a6c"/>
    ${DECOR_BUILDINGS.filter((b) => !b.inField).map((b) => block(b, '#cdbfa6')).join('')}
    ${BUILDINGS.map((b) => block(b, tone[b.tone])).join('')}
    ${UMAS.map((u) => `<circle cx="${u.x}" cy="${u.y}" r="30" fill="#fff" stroke="#ff5c9d" stroke-width="14"><title>${esc(u.name)}</title></circle>`).join('')}
    <rect data-mm-view fill="#fff" fill-opacity=".14" stroke="#fff" stroke-width="22" rx="30"/>
    <circle data-mm-me r="62" fill="#17a35f" stroke="#fff" stroke-width="24"/>
  </svg>`;
}

/** Cor da bandeira do templo: a cor oficial da destacada, ou a secundária se a principal for escura demais. */
function flagColor(char) {
  const lum = (hex) => {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  };
  return lum(char.color) >= 0.42 ? char.color : (char.color2 || '#ff5c9d');
}

function toElement(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function entityBox(x, y, w, h, z) {
  return `left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${Math.round(z)}`;
}

export async function render(el, _params, ctx) {
  const hub = await api.get('/api/hub');
  if (!ctx.alive) return;

  el.classList.add('view-world');
  const banner = hub.events.find((e) => e.kind === 'banner');
  const featured = banner?.character;
  const me = state.me;

  const buildings = BUILDINGS.map((b) => {
    const art = b.prop ? propSvg({ kind: b.kind }) : buildingSvg(b);
    return `<div class="w-ent w-bld" data-entity="building" data-id="${b.id}" role="button" tabindex="0"
      aria-label="${esc(b.label)}" style="${entityBox(b.x, b.y, b.w, b.h, b.y + b.h)}">${art}</div>`;
  }).join('');
  const decor = DECOR_BUILDINGS.map((b) =>
    `<div class="w-ent" style="${entityBox(b.x, b.y, b.w, b.h, b.y + b.h)}">${buildingSvg(b)}</div>`).join('');
  const props = PROPS.map((p) => {
    const x = p.x - (p.ax ?? p.w / 2);
    const y = p.y - (p.ay ?? p.h);
    const attrs = p.id === 'board' ? 'data-entity="board" data-id="board" role="button" tabindex="0" aria-label="Quadro de avisos"' : '';
    const color = p.kind === 'nobori' && featured ? flagColor(featured) : undefined;
    return `<div class="w-ent w-prop k-${p.kind}" ${attrs} style="${entityBox(x, y, p.w, p.h, p.y)}">${propSvg({ ...p, color })}</div>`;
  }).join('');
  const npcs = NPCS.map((n) => {
    const info = hub.npcs[n.id] || {};
    return walkerHtml({ sprite: spriteFor(n.id, true), color: info.color, name: n.name.split(' ')[0],
      sub: n.role, cls: 'npc', entity: 'npc', id: n.id, at: n });
  }).join('');
  const umas = UMAS.map((u) => walkerHtml({ sprite: spriteFor(u.id), name: u.name, cls: 'npc uma', entity: 'uma',
    id: u.id, at: u })).join('');
  const runners = RUNNERS.map((r) => walkerHtml({ sprite: spriteFor(r.id), name: '', cls: 'runner', id: r.id,
    at: trackPoint(r.start, r.offset) })).join('');
  // Telão no meio da pista: anuncia a Dupla Estelar.
  const duo = hub.events.find((e) => e.link === 'gacha/duo');
  const screen = duo ? `
    <div class="w-ent w-screen" style="${entityBox(SCREEN.x - 200, SCREEN.y - 250, 400, 250, SCREEN.y)}">
      <i class="ws-leg"></i><i class="ws-leg"></i>
      <div class="ws-frame"><div class="ws-display">
        ${duo.characters.map((c) => `<img src="${umaImg(c.id, 'card')}" alt="" draggable="false">`).join('')}
        <div class="ws-text"><small>Novo banner</small><b>${esc(duo.title)}</b><span>no Templo da Sorte</span></div>
      </div></div>
    </div>` : '';
  const fence = `<div class="w-ent" style="${entityBox(0, BOUNDS.y1 - 24, WORLD.w, 50, BOUNDS.y1 + 16)}">${southFenceSvg()}</div>`;
  const plates = BUILDINGS.map((b) => `
    <div class="w-plate tone-${b.tone}" data-plate="${b.id}" style="left:${b.door.x}px;top:${b.y - 4}px">
      ${icon(b.icon)}<span>${esc(b.label)}</span><b class="w-plate-badge" data-badge hidden></b>
    </div>`).join('');

  el.innerHTML = `
    <div class="world-wrap">
      <div class="world-viewport" data-viewport tabindex="-1" aria-label="Mundo do UmaWorld">
        <div class="world-layer" data-layer style="width:${WORLD.w}px;height:${WORLD.h}px">
          ${groundSvg()}
          ${buildings}${decor}${props}${fence}${screen}${npcs}${umas}${runners}
          <div class="w-plates">${plates}</div>
          <div class="w-marker" data-marker hidden></div>
          <div class="w-clouds" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        </div>
      </div>

      <div class="wh wh-top">
        <span class="wh-chip">${icon('mappin')}<b data-zone>Academia Tracen</b></span>
        <span class="wh-chip">${icon('users')}<b data-online>${live.online.length}</b>&nbsp;online</span>
      </div>
      <div class="wh wh-minimap" data-minimap>
        <button class="wm-toggle" data-mm-toggle aria-expanded="true">${icon('world')}<span>Mapa</span></button>
        <div class="wm-map" data-mm-map>${minimapSvg()}</div>
      </div>
      <div class="wh wh-prompt" data-prompt hidden></div>
      <div class="wh wh-dock" data-dock></div>
      <div class="wh wh-help">
        <span class="only-pointer">${kbd('W')}${kbd('A')}${kbd('S')}${kbd('D')} andar</span>
        <span class="only-pointer">${kbd('Shift')} correr</span>
        <span class="only-pointer">${kbd('E')} interagir</span>
        <span>${icon('tap')} clique no mapa para ir</span>
      </div>
    </div>`;

  const layer = el.querySelector('[data-layer]');
  const viewport = el.querySelector('[data-viewport]');
  const prompt = el.querySelector('[data-prompt]');

  const avatarChar = () => me.avatar?.character;
  const playerEl = toElement(walkerHtml({
    sprite: avatarChar() ? spriteFor(avatarChar().id) : '', color: avatarChar()?.color,
    name: me.nickname, sub: avatarChar()?.name || '', cls: 'me',
  }));
  layer.appendChild(playerEl);

  // ------------------------------------------------------------- falas e interação

  const bubbleTimers = new WeakMap();
  function say(walker, html, ms = 4200) {
    const bubble = walker?.querySelector('.walker-bubble');
    if (!bubble) return;
    bubble.innerHTML = html;
    bubble.hidden = false;
    clearTimeout(bubbleTimers.get(bubble));
    bubbleTimers.set(bubble, setTimeout(() => { bubble.hidden = true; }, ms));
  }
  /** Ícone que pula em cima da cabeça (a Uma notou você). */
  function emote(walker, name) {
    const node = walker?.querySelector('.walker-emote');
    if (!node || !name) return;
    node.innerHTML = icon(name);
    node.hidden = false;
    node.classList.remove('pop');
    void node.offsetWidth; // reinicia a animação
    node.classList.add('pop');
    clearTimeout(bubbleTimers.get(node));
    bubbleTimers.set(node, setTimeout(() => { node.hidden = true; }, 1700));
  }
  const npcWalker = (id) => layer.querySelector(`.walker.npc[data-id="${id}"]`);
  const pick = (lines) => lines[Math.floor(Math.random() * lines.length)];

  // Cada Uma fala as suas falas em ordem; a Fukukitaru "prevê" a destacada da semana.
  const nextLine = new Map();
  function umaLine(u) {
    const i = nextLine.get(u.id) || 0;
    nextLine.set(u.id, (i + 1) % u.lines.length);
    return u.lines[i].replace('{featured}', featured ? featured.name : 'a destacada da semana');
  }
  function greet(u) {
    const walker = npcWalker(u.id);
    const lookalike = me.avatar?.character?.id === u.id;
    emote(walker, u.emote);
    say(walker, esc(lookalike ? 'Ei... você é a minha cara! Será que é um espelho?' : u.greet), 3800);
  }

  function goToRoute(route) {
    lastPosition = { x: engine.player.x, y: engine.player.y };
    location.hash = `#/${route}`;
  }

  function interact(near) {
    if (near.type === 'building') {
      goToRoute(near.building.route);
    } else if (near.type === 'board') {
      goToRoute('praca');
    } else if (near.type === 'npc') {
      const n = near.npc;
      engine.hop(n.id);
      if (n.talk === 'praca') {
        say(npcWalker(n.id), esc(pick(n.lines)), 1600);
        setTimeout(() => { if (ctx.alive) goToRoute('praca'); }, 900);
      } else if (n.talk === 'news') {
        const lastNews = [...live.events].reverse().find((e) => ['five_star', 'milestone', 'rank_up'].includes(e.kind));
        say(npcWalker(n.id), lastNews
          ? `Última notícia: ${lastNews.nickname ? `<b>${esc(lastNews.nickname)}</b> ` : ''}${formatFeed(lastNews.message)}`
          : esc(pick(n.lines)), 6000);
      } else {
        say(npcWalker(n.id), esc(pick(n.lines)));
      }
    } else if (near.type === 'uma') {
      const u = near.uma;
      engine.hop(u.id);
      say(npcWalker(u.id), esc(umaLine(u)), 4800);
      // A Forever Young e a Marche Lorraine levam até o banner delas.
      if (u.talk === 'duo') setTimeout(() => { if (ctx.alive) goToRoute('gacha/duo'); }, 1600);
    }
  }

  function showPrompt(near) {
    if (!near) { prompt.hidden = true; return; }
    let label;
    if (near.type === 'building') label = `${icon(near.building.icon)}<span>Entrar: <b>${esc(near.building.label)}</b></span>`;
    else if (near.type === 'board') label = `${icon('sign')}<span>Ler o <b>quadro de avisos</b></span>`;
    else if (near.type === 'uma') label = `${icon('talk')}<span>Falar com <b>${esc(near.uma.name)}</b></span>`;
    else label = `${icon('talk')}<span>Falar com <b>${esc(near.npc.name.split(' ')[0])}</b></span>`;
    prompt.innerHTML = `${label}<button class="btn btn-primary btn-sm" data-interact>${kbd('E')} Ir</button>`;
    prompt.hidden = false;
  }

  const engine = new WorldEngine({
    viewport,
    layer,
    playerEl,
    start: startPosition(),
    makeWalker: (info) => toElement(walkerHtml({
      sprite: info.avatar ? spriteFor(info.avatar) : '', name: info.nickname, sub: `Nv. ${info.level}`,
      cls: 'other', entity: 'player', id: info.nickname,
    })),
    onNear: showPrompt,
    onInteract: interact,
    onZone: (zone) => { el.querySelector('[data-zone]').textContent = zone; },
    onPlayerClick: (nick) => { location.hash = `#/perfil/${encodeURIComponent(nick)}`; },
    onGreet: greet,
    onFrame: () => drawMinimap(),
  });

  // ------------------------------------------------------------- minimapa

  const minimap = el.querySelector('[data-minimap]');
  const mmMap = el.querySelector('[data-mm-map]');
  const mmMe = el.querySelector('[data-mm-me]');
  const mmView = el.querySelector('[data-mm-view]');
  function setMinimapOpen(open) {
    minimap.classList.toggle('closed', !open);
    minimap.querySelector('[data-mm-toggle]').setAttribute('aria-expanded', String(open));
    try { localStorage.setItem(MINIMAP_KEY, open ? 'open' : 'closed'); } catch { /* sem armazenamento */ }
  }
  let savedMinimap = null;
  try { savedMinimap = localStorage.getItem(MINIMAP_KEY); } catch { /* sem armazenamento */ }
  setMinimapOpen(savedMinimap ? savedMinimap === 'open' : viewport.clientWidth >= 760);

  function drawMinimap() {
    if (minimap.classList.contains('closed')) return;
    const s = engine.scale;
    mmMe.setAttribute('cx', engine.player.x.toFixed(0));
    mmMe.setAttribute('cy', engine.player.y.toFixed(0));
    mmView.setAttribute('x', (engine.cam.x / s).toFixed(0));
    mmView.setAttribute('y', (engine.cam.y / s).toFixed(0));
    mmView.setAttribute('width', (viewport.clientWidth / s).toFixed(0));
    mmView.setAttribute('height', (viewport.clientHeight / s).toFixed(0));
  }

  minimap.querySelector('[data-mm-toggle]').addEventListener('click', () => {
    setMinimapOpen(minimap.classList.contains('closed'));
  });
  // Clicar no minimapa leva a corredora até o ponto (ou até o lugar livre mais perto).
  mmMap.addEventListener('click', (e) => {
    const box = mmMap.querySelector('svg').getBoundingClientRect();
    engine.goTo({
      x: ((e.clientX - box.left) / box.width) * WORLD.w,
      y: Math.min(BOUNDS.y1 - 10, ((e.clientY - box.top) / box.height) * WORLD.h),
    }, null);
  });

  function applyRunBonus() {
    const speed = me.avatar?.speed || 0;
    engine.runSpeed = 390 + Math.min(130, speed / 10);
  }
  applyRunBonus();

  prompt.addEventListener('click', (e) => {
    if (e.target.closest('[data-interact]') && engine.near) interact(engine.near);
  });

  // Prédios e quadro com foco do teclado: Enter caminha até a porta e entra.
  layer.addEventListener('keydown', (e) => {
    const ent = e.target.closest('[data-entity]');
    if (ent && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      engine.clickEntity(ent.dataset.entity, ent.dataset.id);
    }
  });

  // ------------------------------------------------------------- HUD

  function drawDock() {
    const a = state.me.avatar;
    const dock = el.querySelector('[data-dock]');
    if (!a) { dock.innerHTML = ''; return; }
    dock.innerHTML = `
      ${portrait(a.character, 52)}
      <div class="wh-dock-text">
        <b>${esc(a.character.name)}</b>
        <small>Nv. ${a.level} · ${icon('speed')} ${fmt(a.speed)} de velocidade</small>
      </div>
      <button class="btn btn-sm" data-swap>${icon('swap')} Trocar</button>`;
  }

  function drawBadges() {
    const b = state.badges;
    const set = (id, text, cls = '') => {
      const badge = layer.querySelector(`[data-plate="${id}"] [data-badge]`);
      if (!badge) return;
      badge.hidden = !text;
      badge.textContent = text || '';
      badge.className = `w-plate-badge ${cls}`;
    };
    set('missoes', b.missions ? String(b.missions) : '');
    set('afk', b.afk_full ? 'Cheio!' : (b.afk_ready ? `${String(b.afk_hours.toFixed(1)).replace('.', ',')}h` : ''),
      b.afk_full ? 'alert' : 'soft');
    set('gacha', featured ? featured.name.split(' ')[0] : '', 'soft');
  }

  async function swapAvatar() {
    const res = await api.get('/api/characters');
    const current = state.me.avatar?.user_character_id;
    const modal = openModal({
      title: 'Escolha quem anda pelo mundo',
      icon: 'swap',
      wide: true,
      body: `<p class="muted small" style="margin-bottom:12px">A velocidade da corredora deixa a corrida no mapa um pouco mais rápida.</p>
        <div class="select-grid">${res.characters.map((c) => `
          <button class="selectable ${c.id === current ? 'selected' : ''}" data-pick="${c.id}">
            ${charCard(c.character, { meta: `Nv. ${c.level} · ${icon('speed')} ${fmt(c.stats.speed.total)}` })}
          </button>`).join('')}</div>`,
    });
    modal.el.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-pick]');
      if (!btn) return;
      const out = await act(btn, () => api.put('/api/profile', { avatar_uc_id: Number(btn.dataset.pick) }));
      if (!out || !ctx.alive) return;
      modal.close();
      const a = out.me.avatar;
      playerEl.querySelector('.walker-sprite').src = spriteFor(a.character.id);
      playerEl.querySelector('.walker-body').classList.remove('nosprite');
      playerEl.querySelector('.walker-body').style.setProperty('--c', a.character.color);
      playerEl.querySelector('.walker-tag small').textContent = a.character.name;
      applyRunBonus();
      drawDock();
      say(playerEl, 'Vamos nessa!', 2200);
      toast(`${icon('swap')}<span>${esc(a.character.name)} agora anda pelo mundo.</span>`, 'success');
    });
  }

  el.querySelector('[data-dock]').addEventListener('click', (e) => {
    if (e.target.closest('[data-swap]')) swapAvatar().catch((err) => toast(esc(err.message), 'error'));
  });

  // ------------------------------------------------------------- tempo real

  const others = () => live.online.filter((p) => p.nickname !== me.nickname);
  engine.setOnline(others());

  ctx.onCleanup(subscribe((type, ev) => {
    if (type === 'presence') {
      engine.setOnline(others());
      el.querySelector('[data-online]').textContent = live.online.length;
    } else if (type === 'feed') {
      const text = formatFeed(ev.message);
      if (ev.nickname === me.nickname) say(playerEl, text, 5200);
      else if (ev.nickname && engine.npcs.has(ev.nickname)) say(engine.npcs.get(ev.nickname).el, text, 5200);
      if (['five_star', 'milestone', 'rank_up'].includes(ev.kind)) {
        say(npcWalker('etsuko'), `Extra! ${ev.nickname ? `<b>${esc(ev.nickname)}</b> ` : ''}${text}`, 6500);
      }
    }
  }));
  ctx.onCleanup(onState(() => { drawDock(); drawBadges(); }));
  ctx.onCleanup(() => {
    lastPosition = { x: engine.player.x, y: engine.player.y };
    engine.destroy();
  });

  drawDock();
  drawBadges();
  engine.mount();
  viewport.focus({ preventScroll: true });
  setTimeout(() => { if (ctx.alive) say(npcWalker('tazuna'), 'Boas-vindas! Fale comigo para ver os avisos.', 4200); }, 900);
}
