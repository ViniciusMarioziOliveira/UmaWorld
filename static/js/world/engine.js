// Motor do mundo: teclado/clique/toque, movimento com colisão, caminho (A*), câmera,
// jogadores online passeando pela Praça, Umas que reagem a quem chega perto,
// corredoras na pista e detecção de portas/NPCs próximos.

import {
  BUILDINGS, NPCS, PLAZA, PROPS, RUNNERS, UMAS, WORLD,
  buildColliders, doorExit, doorTrigger, inOverlook, trackPoint, zoneAt,
} from './layout.js';

const FOOT_W = 26;
const FOOT_H = 12;
const CELL = 16;
const WALK_SPEED = 215;
const RUN_SPEED = 390;
const NPC_SPEED = 115;
const TALK_RADIUS = 78;
const ACCEL_TIME = 0.16;   // s até a velocidade cheia ao sair do lugar
const STRIDE_WALK = 44;    // px do mundo por passo
const STRIDE_RUN = 74;
const TURN_TIME = 0.14;    // s para virar de lado (a arte gira como papel)
const HOP_TIME = 0.32;
const LOOK_RADIUS = 230;   // NPCs da Academia olham para quem chega perto
const GREET_RADIUS = 170;  // as Umas puxam conversa...
const GREET_RESET = 340;   // ...e só de novo depois que a jogadora se afasta
const UMA_WALK = 95;
const OVERLOOK_ZOOM = 0.58; // no Mirante a câmera se afasta...
const OVERLOOK_PEEK = 380;  // ...e desce para mostrar a pista

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];
const BOARD = PROPS.find((p) => p.id === 'board');

function hits(box, c) {
  if (c.rect) {
    const r = c.rect;
    return box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y;
  }
  const e = c.ellipse;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rx = e.rx + box.w / 2;
  const ry = e.ry + box.h / 2;
  return ((cx - e.x) / rx) ** 2 + ((cy - e.y) / ry) ** 2 < 1;
}

// ------------------------------------------------------------- passada procedural
// A arte de cada corredora é uma imagem parada; o "andar" vem daqui. A fase avança com a
// distância percorrida (o quique acompanha a velocidade, sem pé deslizando), com inclinação
// para o lado do movimento, achatamento no apoio, troca de peso entre os pés e respiração.

function newGait(face) {
  return { phase: Math.random(), amp: 0, run: 0, lean: 0, face, turn: face, breath: Math.random() * 6.3, hop: 0 };
}

/** Atualiza a passada; devolve true no quadro em que um pé toca o chão. */
function stepGait(g, dt, moved, running, dirX, face) {
  const moving = moved > 0.05;
  g.amp += ((moving ? 1 : 0) - g.amp) * (1 - Math.exp(-dt * (moving ? 14 : 8)));
  g.run += ((running ? 1 : 0) - g.run) * (1 - Math.exp(-dt * 8));
  const before = Math.floor(g.phase);
  if (moving) g.phase += moved / (STRIDE_WALK + (STRIDE_RUN - STRIDE_WALK) * g.run);
  else g.phase += (Math.round(g.phase) - g.phase) * (1 - Math.exp(-dt * 12)); // assenta ao parar
  const lean = moving ? Math.max(-1, Math.min(1, dirX)) * (3 + 6 * g.run) : 0;
  g.lean += (lean - g.lean) * (1 - Math.exp(-dt * 9));
  g.face = face;
  const turn = (dt / TURN_TIME) * 2;
  g.turn = g.turn < face ? Math.min(face, g.turn + turn) : Math.max(face, g.turn - turn);
  g.breath += dt;
  g.hop = Math.max(0, g.hop - dt);
  return moving && Math.floor(g.phase) !== before;
}

function gaitPose(g) {
  const air = Math.sin((g.phase - Math.floor(g.phase)) * Math.PI); // 0 no apoio, 1 no alto
  const contact = (1 - air) ** 3;
  const a = g.amp;
  const hop = g.hop > 0 ? Math.sin((1 - g.hop / HOP_TIME) * Math.PI) : 0;
  const breathe = Math.sin(g.breath * 2.4) * 0.012 * (1 - a);
  return {
    y: -air * (5 + 6 * g.run) * a - hop * 10,
    rot: g.lean + Math.sin(g.phase * Math.PI) * (1.6 + 1.4 * g.run) * a,
    sx: (1 - breathe * 0.4 + (contact * 0.04 - air * 0.015) * a - hop * 0.02) * -g.turn, // a arte original olha para a esquerda
    sy: 1 + breathe + (air * 0.03 - contact * 0.05) * a + hop * 0.04,
    shadow: 1 - air * a * 0.25 - hop * 0.3,
  };
}

function walkerParts(el) {
  return { body: el.querySelector('.walker-body'), shadow: el.querySelector('.walker-shadow') };
}

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(value, priority) {
    const a = this.items;
    a.push([priority, value]);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent][0] <= a[i][0]) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top[1];
  }
}

export class WorldEngine {
  constructor({ viewport, layer, playerEl, start, makeWalker, onNear, onInteract, onZone, onPlayerClick, onGreet, onFrame }) {
    this.viewport = viewport;
    this.layer = layer;
    this.makeWalker = makeWalker;
    this.onNear = onNear;
    this.onInteract = onInteract;
    this.onZone = onZone;
    this.onPlayerClick = onPlayerClick;
    this.onGreet = onGreet;
    this.onFrame = onFrame;
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.colliders = buildColliders();
    this.cols = Math.ceil(WORLD.w / CELL);
    this.rows = Math.ceil(WORLD.h / CELL);
    this.grid = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        this.grid[r * this.cols + c] = this.blocked(c * CELL + CELL / 2, r * CELL + CELL / 2) ? 1 : 0;
      }
    }

    const spot = this.freeSpot(start.x, start.y);
    this.player = { x: spot.x, y: spot.y, el: playerEl, ...walkerParts(playerEl), gait: newGait(1), path: [],
      intent: null, face: 1, vx: 0, vy: 0, ramp: 0, moving: false, running: false, autoRun: false, stuck: 0 };
    this.runSpeed = RUN_SPEED;
    this.keys = new Set();
    this.shift = false;
    this.npcs = new Map();
    // NPCs fixos da Academia: só respiram e viram para olhar quem passa.
    this.statics = NPCS.map((n) => {
      const el = layer.querySelector(`.walker.npc[data-id="${n.id}"]`);
      return el && { id: n.id, x: n.x, y: n.y, el, ...walkerParts(el), gait: newGait(-1) };
    }).filter(Boolean);
    // Umas pela Academia: passeiam, fazem ronda ou ficam no lugar; reagem a quem chega perto.
    this.umas = UMAS.map((u) => {
      const el = layer.querySelector(`.walker.uma[data-id="${u.id}"]`);
      const rest = u.facing || -1;
      return el && { ...u, home: { x: u.x, y: u.y }, el, ...walkerParts(el), gait: newGait(rest), rest, face: rest,
        path: [], wait: 1 + Math.random() * 3, leg: 0, greeted: false };
    }).filter(Boolean);
    // Corredoras dando voltas na pista lá embaixo, cada uma no seu ritmo.
    this.runners = RUNNERS.map((r) => {
      const el = layer.querySelector(`.walker.runner[data-id="${r.id}"]`);
      const at = trackPoint(r.start, r.offset);
      return el && { ...r, el, ...walkerParts(el), gait: newGait(-1), s: r.start, x: at.x, y: at.y, face: -1,
        speed: r.pace, target: r.pace, retarget: Math.random() * 3 };
    }).filter(Boolean);
    this.cam = { x: 0, y: 0 };
    this.lead = { x: 0, y: 0 };
    this.baseScale = 1;
    this.zoom = 1;
    this.peek = 0;
    this.scale = 1;
    this.snap = true;
    this.near = null;
    this.zone = '';
    this.zoneTimer = 0;
    this.last = 0;
    this.marker = layer.querySelector('[data-marker]');

    this.tick = this.tick.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  // ------------------------------------------------------------- ciclo de vida

  mount() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.viewport.addEventListener('pointerdown', this.onPointerDown);
    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(this.viewport);
    this.onResize();
    this.raf = requestAnimationFrame(this.tick);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.viewport.removeEventListener('pointerdown', this.onPointerDown);
    this.resizeObserver?.disconnect();
  }

  onResize() {
    const vw = this.viewport.clientWidth;
    this.baseScale = vw < 760 ? 0.68 : vw < 1000 ? 0.84 : 1;
    this.scale = this.baseScale * this.zoom;
    this.snap = true;
  }

  // ------------------------------------------------------------- colisão e grade

  blocked(x, y) {
    const box = { x: x - FOOT_W / 2, y: y - FOOT_H, w: FOOT_W, h: FOOT_H };
    for (const c of this.colliders) if (hits(box, c)) return true;
    return false;
  }

  cellIndex(x, y) {
    const c = Math.max(0, Math.min(this.cols - 1, Math.floor(x / CELL)));
    const r = Math.max(0, Math.min(this.rows - 1, Math.floor(y / CELL)));
    return r * this.cols + c;
  }

  cellCenter(i) {
    return { x: (i % this.cols) * CELL + CELL / 2, y: Math.floor(i / this.cols) * CELL + CELL / 2 };
  }

  nearestFree(index) {
    const { cols, rows, grid } = this;
    const cx = index % cols;
    const cy = Math.floor(index / cols);
    for (let radius = 1; radius < 40; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          if (!grid[y * cols + x]) return y * cols + x;
        }
      }
    }
    return -1;
  }

  freeSpot(x, y) {
    if (!this.blocked(x, y)) return { x, y };
    const i = this.nearestFree(this.cellIndex(x, y));
    return i >= 0 ? this.cellCenter(i) : { x, y };
  }

  lineClear(a, b) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELL / 2));
    for (let k = 1; k <= n; k += 1) {
      const t = k / n;
      if (this.grid[this.cellIndex(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)]) return false;
    }
    return true;
  }

  /** A* na grade (8 direções, sem cortar quinas) + suavização por linha de visão. */
  findPath(sx, sy, tx, ty) {
    const { cols, rows, grid } = this;
    const start = this.cellIndex(sx, sy);
    let goal = this.cellIndex(tx, ty);
    if (grid[goal]) goal = this.nearestFree(goal);
    if (goal < 0) return null;
    if (goal === start) return this.blocked(tx, ty) ? [] : [{ x: tx, y: ty }];

    const gx = goal % cols;
    const gy = Math.floor(goal / cols);
    const heuristic = (i) => {
      const dx = Math.abs((i % cols) - gx);
      const dy = Math.abs(Math.floor(i / cols) - gy);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    const g = new Float32Array(cols * rows).fill(Infinity);
    const came = new Int32Array(cols * rows).fill(-1);
    const closed = new Uint8Array(cols * rows);
    const open = new MinHeap();
    g[start] = 0;
    open.push(start, heuristic(start));
    let found = false;
    let guard = 0;
    while (open.size) {
      const cur = open.pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      if ((guard += 1) > 60000) break;
      const cx = cur % cols;
      const cy = Math.floor(cur / cols);
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (grid[ni] || closed[ni]) continue;
        if (dx && dy && (grid[cy * cols + nx] || grid[ny * cols + cx])) continue;
        const ng = g[cur] + cost;
        if (ng < g[ni]) {
          g[ni] = ng;
          came[ni] = cur;
          open.push(ni, ng + heuristic(ni));
        }
      }
    }
    if (!found) return null;

    const cells = [];
    for (let c = goal; c !== -1 && c !== start; c = came[c]) cells.push(c);
    cells.reverse();
    const points = cells.map((c) => this.cellCenter(c));
    if (Math.abs(tx - points.at(-1).x) < CELL && Math.abs(ty - points.at(-1).y) < CELL && !this.blocked(tx, ty)) {
      points[points.length - 1] = { x: tx, y: ty };
    }
    const out = [];
    let anchor = { x: sx, y: sy };
    let i = 0;
    while (i < points.length) {
      let j = points.length - 1;
      while (j > i && !this.lineClear(anchor, points[j])) j -= 1;
      out.push(points[j]);
      anchor = points[j];
      i = j + 1;
    }
    return out;
  }

  // ------------------------------------------------------------- entrada

  ignoring(e, forInteract = false) {
    if (document.querySelector('.modal-backdrop, .reveal')) return true;
    const t = e.target;
    if (!(t instanceof Element)) return false;
    if (t.closest('input, textarea, select, [contenteditable="true"]')) return true;
    return forInteract && Boolean(t.closest('button, a, [data-entity]'));
  }

  onKeyDown(e) {
    const dir = KEYMAP[e.code];
    if (dir) {
      if (this.ignoring(e)) return;
      this.keys.add(dir);
      e.preventDefault();
    } else if (e.key === 'Shift') {
      this.shift = true;
    } else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
      if (this.ignoring(e, true) || !this.near) return;
      e.preventDefault();
      this.onInteract(this.near);
    }
  }

  onKeyUp(e) {
    const dir = KEYMAP[e.code];
    if (dir) this.keys.delete(dir);
    if (e.key === 'Shift') this.shift = false;
  }

  onBlur() {
    this.keys.clear();
    this.shift = false;
  }

  toWorld(clientX, clientY) {
    const rect = this.viewport.getBoundingClientRect();
    return { x: (clientX - rect.left + this.cam.x) / this.scale, y: (clientY - rect.top + this.cam.y) / this.scale };
  }

  onPointerDown(e) {
    if (e.button !== 0 || e.target.closest('.wh')) return;
    const entity = e.target.closest('[data-entity]');
    if (entity) {
      this.clickEntity(entity.dataset.entity, entity.dataset.id);
      return;
    }
    this.goTo(this.toWorld(e.clientX, e.clientY), null);
  }

  clickEntity(kind, id) {
    if (kind === 'player') {
      this.onPlayerClick(id);
    } else if (kind === 'building') {
      const b = BUILDINGS.find((x) => x.id === id);
      this.goTo(doorExit(b), { type: 'building', id });
    } else if (kind === 'npc') {
      const n = NPCS.find((x) => x.id === id);
      this.goTo({ x: n.x, y: n.y + 46 }, { type: 'npc', id });
    } else if (kind === 'uma') {
      const u = this.umas.find((x) => x.id === id);
      if (u) this.goTo({ x: u.x, y: u.y + 46 }, { type: 'uma', id });
    } else if (kind === 'board') {
      this.goTo({ x: BOARD.x, y: BOARD.y + 46 }, { type: 'board', id: 'board' });
    }
  }

  goTo(target, intent) {
    const p = this.player;
    const path = this.findPath(p.x, p.y, target.x, target.y);
    if (!path) return;
    p.path = path;
    p.intent = intent;
    p.autoRun = Math.hypot(target.x - p.x, target.y - p.y) > 420;
    p.stuck = 0;
    if (path.length) this.showMarker(path.at(-1), Boolean(intent));
    else this.arrive();
  }

  // ------------------------------------------------------------- simulação

  tick(t) {
    const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0;
    this.last = t;
    this.update(dt);
    this.render();
    this.onFrame?.();
    this.raf = requestAnimationFrame(this.tick);
  }

  moveBy(dx, dy) {
    const p = this.player;
    if (dx && !this.blocked(p.x + dx, p.y)) p.x += dx;
    if (dy && !this.blocked(p.x, p.y + dy)) p.y += dy;
  }

  update(dt) {
    const p = this.player;
    let ix = 0;
    let iy = 0;
    if (this.keys.has('left')) ix -= 1;
    if (this.keys.has('right')) ix += 1;
    if (this.keys.has('up')) iy -= 1;
    if (this.keys.has('down')) iy += 1;

    let vx = 0;
    let vy = 0;
    let speed = WALK_SPEED;
    if (ix || iy) {
      if (p.path.length) { p.path = []; p.intent = null; this.hideMarker(); }
      speed = this.shift ? this.runSpeed : WALK_SPEED;
      const len = Math.hypot(ix, iy);
      vx = (ix / len) * speed;
      vy = (iy / len) * speed;
    } else if (p.path.length) {
      speed = p.autoRun || this.shift ? this.runSpeed : WALK_SPEED;
      const wp = p.path[0];
      const dx = wp.x - p.x;
      const dy = wp.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 3 || (dt && dist < speed * dt)) {
        if (!this.blocked(wp.x, wp.y)) { p.x = wp.x; p.y = wp.y; }
        p.path.shift();
        if (!p.path.length) this.arrive();
      } else {
        vx = (dx / dist) * speed;
        vy = (dy / dist) * speed;
      }
    }

    // Arranque suave: sai do lugar a ~45% da velocidade e chega à cheia em ACCEL_TIME.
    if (ix || iy || p.path.length) {
      p.ramp = Math.min(1, p.ramp + dt / ACCEL_TIME);
      const k = 0.45 + 0.55 * (1 - (1 - p.ramp) ** 2);
      vx *= k;
      vy *= k;
    } else {
      p.ramp = 0;
    }

    const ox = p.x;
    const oy = p.y;
    if (vx || vy) this.moveBy(vx * dt, vy * dt);
    const moved = Math.hypot(p.x - ox, p.y - oy);
    p.moving = moved > 0.05 || ((vx || vy) && dt === 0);
    p.running = p.moving && speed > WALK_SPEED;
    p.vx = p.moving && dt ? (p.x - ox) / dt : 0;
    p.vy = p.moving && dt ? (p.y - oy) / dt : 0;
    if (Math.abs(vx) > 20) p.face = vx < 0 ? -1 : 1;
    const stepped = stepGait(p.gait, dt, moved, p.running, moved ? (p.x - ox) / moved : 0, p.face);

    if (p.path.length && (vx || vy) && dt) {
      if (moved < speed * dt * 0.2) {
        p.stuck += dt;
        if (p.stuck > 0.4) {
          p.stuck = 0;
          p.path.shift();
          if (!p.path.length) this.arrive();
        }
      } else {
        p.stuck = 0;
      }
    }

    // Poeira a cada pisada da corrida, alternando os pés.
    if (stepped && p.running && !this.reduceMotion) {
      this.spawnDust(p.x - p.face * 10 + (Math.floor(p.gait.phase) % 2 ? 7 : -7), p.y);
    }

    this.updateNear();
    this.updateNpcs(dt);
    this.updateStatics(dt);
    this.updateUmas(dt);
    this.updateRunners(dt);
    this.updateZoom(dt);
    this.updateCamera(dt);

    this.zoneTimer -= dt;
    if (this.zoneTimer <= 0) {
      this.zoneTimer = 0.25;
      const zone = zoneAt(p.x, p.y);
      if (zone !== this.zone) { this.zone = zone; this.onZone(zone); }
    }
  }

  arrive() {
    const p = this.player;
    this.hideMarker();
    const intent = p.intent;
    p.intent = null;
    p.autoRun = false;
    if (!intent) return;
    this.updateNear();
    if (this.near && this.near.type === intent.type && this.near.id === intent.id) this.onInteract(this.near);
  }

  updateNear() {
    const p = this.player;
    let near = null;
    for (const b of BUILDINGS) {
      const t = doorTrigger(b);
      if (p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h) {
        near = { type: 'building', id: b.id, building: b };
        break;
      }
    }
    if (!near) {
      for (const n of NPCS) {
        if (Math.hypot(p.x - n.x, p.y - n.y) < TALK_RADIUS) { near = { type: 'npc', id: n.id, npc: n }; break; }
      }
    }
    if (!near) {
      for (const u of this.umas) {
        if (Math.hypot(p.x - u.x, p.y - u.y) < TALK_RADIUS) { near = { type: 'uma', id: u.id, uma: u }; break; }
      }
    }
    if (!near && Math.hypot(p.x - BOARD.x, p.y - BOARD.y) < TALK_RADIUS) near = { type: 'board', id: 'board' };
    if ((near && near.id) !== (this.near && this.near.id)) {
      this.near = near;
      this.onNear(near);
    }
  }

  updateCamera(dt) {
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;
    const s = this.scale;
    const p = this.player;
    // A câmera olha um pouco à frente de quem está andando.
    const kl = this.reduceMotion ? 1 : 1 - Math.exp(-dt * 3);
    this.lead.x += ((this.reduceMotion ? 0 : p.vx * 0.16) - this.lead.x) * kl;
    this.lead.y += ((this.reduceMotion ? 0 : p.vy * 0.12) - this.lead.y) * kl;
    const clampAxis = (value, world, view) => (world * s <= view ? (world * s - view) / 2
      : Math.max(0, Math.min(world * s - view, value)));
    const tx = clampAxis((p.x + this.lead.x) * s - vw / 2, WORLD.w, vw);
    const ty = clampAxis((p.y + this.lead.y - 70 + this.peek) * s - vh / 2, WORLD.h, vh);
    if (this.snap || this.reduceMotion) {
      this.cam.x = tx;
      this.cam.y = ty;
      this.snap = false;
    } else {
      const k = 1 - Math.exp(-dt * 7);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }
  }

  render() {
    this.place(this.player);
    for (const n of this.npcs.values()) this.place(n);
    for (const s of this.statics) this.pose(s);
    for (const u of this.umas) this.place(u);
    for (const r of this.runners) this.place(r);
    this.layer.style.transform =
      `translate3d(${(-this.cam.x).toFixed(1)}px, ${(-this.cam.y).toFixed(1)}px, 0) scale(${this.scale})`;
  }

  place(ent) {
    ent.el.style.transform = `translate3d(${ent.x.toFixed(1)}px, ${ent.y.toFixed(1)}px, 0)`;
    ent.el.style.zIndex = Math.round(ent.y);
    this.pose(ent);
  }

  pose(ent) {
    if (!ent.body) return;
    if (this.reduceMotion) {
      ent.body.style.transform = `translateX(-50%) scaleX(${ent.gait.face > 0 ? -1 : 1})`;
      return;
    }
    const p = gaitPose(ent.gait);
    ent.body.style.transform = `translateX(-50%) translateY(${p.y.toFixed(2)}px) rotate(${p.rot.toFixed(2)}deg) `
      + `scale(${p.sx.toFixed(3)}, ${p.sy.toFixed(3)})`;
    if (ent.shadow) ent.shadow.style.transform = `scale(${p.shadow.toFixed(3)})`;
  }

  /** Pulinho de um NPC ou de uma Uma (ao conversar). */
  hop(id) {
    const s = this.statics.find((x) => x.id === id) || this.umas.find((x) => x.id === id);
    if (s && !this.reduceMotion) s.gait.hop = HOP_TIME;
  }

  /** Anda `step` px pelo caminho de uma personagem, virando para o lado do movimento. */
  stepAlong(n, step) {
    const wp = n.path[0];
    const dx = wp.x - n.x;
    const dy = wp.y - n.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= step) {
      n.x = wp.x;
      n.y = wp.y;
      n.path.shift();
    } else {
      n.x += (dx / dist) * step;
      n.y += (dy / dist) * step;
      if (Math.abs(dx) > 4) n.face = dx < 0 ? -1 : 1;
    }
  }

  /**
   * Umas pela Academia. Quando a jogadora chega perto, param, viram para ela e
   * puxam conversa uma vez (de novo só depois que ela se afastar).
   */
  updateUmas(dt) {
    const p = this.player;
    for (const u of this.umas) {
      const dx = p.x - u.x;
      const dist = Math.hypot(dx, p.y - u.y);
      const ox = u.x;
      const oy = u.y;
      let running = false;
      if (dist <= LOOK_RADIUS) {
        u.path = [];
        if (Math.abs(dx) > 18) u.face = dx > 0 ? 1 : -1;
      } else if (u.move === 'wander') {
        this.wanderUma(u, dt);
      } else if (u.move === 'patrol') {
        running = this.patrolUma(u, dt);
      } else {
        u.face = u.rest;
      }
      if (dist < GREET_RADIUS) {
        if (!u.greeted) {
          u.greeted = true;
          if (!this.reduceMotion) u.gait.hop = HOP_TIME;
          this.onGreet?.(u);
        }
      } else if (dist > GREET_RESET) {
        u.greeted = false;
      }
      const moved = Math.hypot(u.x - ox, u.y - oy);
      stepGait(u.gait, dt, moved, running, moved ? (u.x - ox) / moved : 0, u.face);
    }
  }

  /** Passeia num raio em volta de casa: anda até um ponto livre, espera e escolhe outro. */
  wanderUma(u, dt) {
    if (u.path.length) {
      this.stepAlong(u, UMA_WALK * dt);
      if (!u.path.length) u.wait = 2 + Math.random() * 4;
      return;
    }
    u.wait -= dt;
    if (u.wait > 0) return;
    u.wait = 3;
    for (let i = 0; i < 8; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * u.radius;
      const x = u.home.x + Math.cos(a) * r;
      const y = u.home.y + Math.sin(a) * r * 0.6;
      if (!this.blocked(x, y)) {
        u.path = this.findPath(u.x, u.y, x, y) || [];
        return;
      }
    }
  }

  /** Vai e volta entre dois pontos (o caminho é livre de propósito no mapa). */
  patrolUma(u, dt) {
    if (u.wait > 0) {
      u.wait -= dt;
      return false;
    }
    if (!u.path.length) u.path = [u.leg ? u.b : u.a];
    const speed = u.speed || UMA_WALK;
    this.stepAlong(u, speed * dt);
    if (!u.path.length) {
      u.leg = u.leg ? 0 : 1;
      u.wait = 1 + Math.random() * 2;
    }
    return speed > WALK_SPEED;
  }

  /** Corredoras na pista: o ritmo de cada uma varia um pouco, então elas se ultrapassam. */
  updateRunners(dt) {
    for (const r of this.runners) {
      r.retarget -= dt;
      if (r.retarget <= 0) {
        r.retarget = 2 + Math.random() * 3;
        r.target = r.pace * (0.9 + Math.random() * 0.2);
      }
      r.speed += (r.target - r.speed) * (1 - Math.exp(-dt * 0.8));
      r.s += r.speed * dt;
      const at = trackPoint(r.s, r.offset);
      const moved = Math.hypot(at.x - r.x, at.y - r.y);
      r.x = at.x;
      r.y = at.y;
      if (Math.abs(at.dx) > Math.abs(at.dy) * 0.3) r.face = at.dx < 0 ? -1 : 1;
      stepGait(r.gait, dt, moved, true, Math.sign(at.dx), r.face);
    }
  }

  /** No Mirante a câmera se afasta e desce até mostrar a pista; fora dele, volta ao normal. */
  updateZoom(dt) {
    const looking = inOverlook(this.player.x, this.player.y);
    const zoomTo = looking ? OVERLOOK_ZOOM : 1;
    const peekTo = looking ? OVERLOOK_PEEK : 0;
    const k = this.reduceMotion ? 1 : 1 - Math.exp(-dt * 2.4);
    this.zoom += (zoomTo - this.zoom) * k;
    this.peek += (peekTo - this.peek) * k;
    if (Math.abs(this.zoom - zoomTo) < 0.002) this.zoom = zoomTo;
    this.scale = this.baseScale * this.zoom;
  }

  updateStatics(dt) {
    const p = this.player;
    for (const s of this.statics) {
      let face = s.gait.face;
      const dx = p.x - s.x;
      const near = Math.hypot(dx, p.y - s.y) <= LOOK_RADIUS;
      if (!near) face = -1;
      else if (Math.abs(dx) > 18) face = dx > 0 ? 1 : -1; // margem para não ficar virando no lugar
      if (near && face !== s.gait.face && !this.reduceMotion) s.gait.hop = HOP_TIME; // vira com um pulinho
      stepGait(s.gait, dt, 0, false, 0, face);
    }
  }

  // ------------------------------------------------------------- efeitos

  spawnDust(x, y) {
    const d = document.createElement('i');
    d.className = 'w-dust';
    d.style.transform = `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, 0)`;
    d.style.zIndex = Math.round(y) - 1;
    this.layer.appendChild(d);
    setTimeout(() => d.remove(), 520);
  }

  showMarker(point, entity) {
    if (!this.marker) return;
    this.marker.hidden = false;
    this.marker.classList.toggle('entity', entity);
    this.marker.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    this.marker.style.zIndex = Math.round(point.y) - 2;
  }

  hideMarker() {
    if (this.marker) this.marker.hidden = true;
  }

  // ------------------------------------------------------------- outros jogadores

  plazaSpot() {
    for (let i = 0; i < 40; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = 125 + Math.random() * 95;
      const x = PLAZA.x + Math.cos(a) * r;
      const y = PLAZA.y + Math.sin(a) * r;
      if (!this.blocked(x, y)) return { x, y };
    }
    return { x: PLAZA.x, y: PLAZA.y + 170 };
  }

  setOnline(players) {
    const keep = new Set();
    for (const info of players) {
      keep.add(info.nickname);
      let n = this.npcs.get(info.nickname);
      if (!n) {
        const spot = this.plazaSpot();
        const face = Math.random() > 0.5 ? 1 : -1;
        const el = this.makeWalker(info);
        n = { ...spot, el, ...walkerParts(el), gait: newGait(face), avatar: info.avatar, path: [],
          wait: Math.random() * 3, face, moving: false };
        this.layer.appendChild(n.el);
        this.npcs.set(info.nickname, n);
      } else if (n.avatar !== info.avatar) {
        n.avatar = info.avatar;
        const fresh = this.makeWalker(info);
        n.el.replaceWith(fresh);
        Object.assign(n, { el: fresh, ...walkerParts(fresh) });
      }
    }
    for (const [nick, n] of this.npcs) {
      if (!keep.has(nick)) { n.el.remove(); this.npcs.delete(nick); }
    }
  }

  updateNpcs(dt) {
    for (const n of this.npcs.values()) {
      const ox = n.x;
      const oy = n.y;
      this.wander(n, dt);
      const moved = Math.hypot(n.x - ox, n.y - oy);
      stepGait(n.gait, dt, moved, false, moved ? (n.x - ox) / moved : 0, n.face);
    }
  }

  /** Jogador online passeando: vai até um ponto da Praça, espera um pouco e escolhe outro. */
  wander(n, dt) {
    if (n.path.length) {
      this.stepAlong(n, NPC_SPEED * dt);
      n.moving = true;
      if (!n.path.length) n.wait = 2 + Math.random() * 5;
    } else {
      n.moving = false;
      n.wait -= dt;
      if (n.wait <= 0) {
        const target = this.plazaSpot();
        n.path = this.findPath(n.x, n.y, target.x, target.y) || [];
        n.wait = 3;
      }
    }
  }
}
