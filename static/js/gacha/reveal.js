// Revelação dos pulls, inspirada no "warp" de Honkai: Star Rail.
//
// 1. Bilhete: entra na tela enquanto o servidor sorteia. Toque (ou arraste) para rasgar.
// 2. Carga: a luz que vaza do picote já conta a maior raridade: azul (3★), roxa (4★) ou o
//    bilhete inteiro vira cromado/holográfico (5★).
// 3. Rasgo: o bilhete se parte, as estrelas viram um túnel de dobra e as cartas são distribuídas.
// 4. Cartas: viram uma a uma. 4★ e 5★ carregam antes de virar, e o efeito da 5★ (anel
//    holográfico, cacos e a arte em destaque) sai da própria carta, no instante em que ela vira.
//
// As imagens são carregadas antes do rasgo, então nada "pisca" ou aparece pela metade.

import { esc, icon, initials, money, portrait, stars, umaImg } from '../ui.js';

/** Resultado de cada pull (no histórico só vem o tipo; na revelação também os números). */
export const OUTCOME = {
  new: () => '<span class="outcome new">NOVA!</span>',
  awakening: (r) => `<span class="outcome awakening">${r.awakening ? `Despertar ${r.awakening}/5` : 'Despertar +1'}</span>`,
  fragments: (r) => `<span class="outcome fragments">${r.fragments ? `+${r.fragments} fragmentos` : 'Fragmentos'}</span>`,
};

export const OUTCOME_CHIP = {
  new: () => `<span class="chip chip-pink">${icon('sparkle')}Nova no estábulo!</span>`,
  awakening: (r) => `<span class="chip chip-purple">${icon('awakening')}Despertar ${r.awakening}/5</span>`,
  fragments: (r) => `<span class="chip chip-sky">${icon('fragment')}+${r.fragments} fragmentos</span>`,
};

export const TONE = { 3: [95, 168, 255], 4: [184, 132, 255], 5: [255, 213, 110], 6: [94, 233, 214] };
const STARLIGHT = [205, 218, 255];
export const WHITE = [255, 255, 255];
export const RAINBOW = [[255, 111, 216], [255, 211, 110], [121, 255, 176], [111, 214, 255], [169, 139, 255]];
const SEAM = 74; // posição do picote, em % da largura do bilhete

export const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function toElement(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ------------------------------------------------------------- céu e partículas (canvas)

function sparkle(ctx, x, y, s, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(0, 0, s, 0);
  ctx.quadraticCurveTo(0, 0, 0, s);
  ctx.quadraticCurveTo(0, 0, -s, 0);
  ctx.quadraticCurveTo(0, 0, 0, -s);
  ctx.fill();
  ctx.restore();
}

/** Pétala (ponta para cima, com o entalhe na ponta), do tamanho `s`. */
function petal(ctx, x, y, s, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.bezierCurveTo(-s * 0.95, s * 0.35, -s * 0.7, -s * 0.85, -s * 0.18, -s);
  ctx.lineTo(0, -s * 0.78);
  ctx.lineTo(s * 0.18, -s);
  ctx.bezierCurveTo(s * 0.7, -s * 0.85, s * 0.95, s * 0.35, 0, s);
  ctx.fill();
  ctx.restore();
}

/** Estrelas que viram túnel de dobra (fundo) + faíscas, anéis e partículas que convergem (frente). */
export class Sky {
  constructor(back, front, reduce) {
    this.canvases = [back, front];
    this.back = back.getContext('2d');
    this.front = front.getContext('2d');
    this.reduce = reduce;
    this.stars = [];
    this.parts = [];
    this.rings = [];
    this.speed = 0.04;
    this.level = 0;
    this.warpUntil = 0;
    this.warpPower = 0;
    this.tint = [...STARLIGHT];
    this.tintTo = [...STARLIGHT];
    this.rainbow = 0;
    this.rainbowTo = 0;
    this.time = 0;
    this.last = 0;
    this.frame = this.frame.bind(this);
    this.resize = this.resize.bind(this);
  }

  start() {
    window.addEventListener('resize', this.resize);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    for (const c of this.canvases) {
      c.width = Math.round(this.w * dpr);
      c.height = Math.round(this.h * dpr);
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const n = Math.round(Math.min(340, Math.max(120, (this.w * this.h) / 4800)));
    while (this.stars.length < n) this.stars.push(this.star(Math.random()));
    this.stars.length = n;
  }

  star(z = 1) {
    return { x: rand(-0.9, 0.9), y: rand(-0.9, 0.9), z: Math.max(0.08, z), tw: rand(0, 6.3) };
  }

  tone(rgb, rainbow = false) {
    this.tintTo = rgb;
    this.rainbowTo = rainbow ? 1 : 0;
  }

  /** 0 = deriva calma; 1 = estrelas já esticando. */
  charge(level) { this.level = level; }

  /** Com a tela coberta por um fundo opaco, o campo de estrelas para de ser desenhado (as partículas continuam). */
  cover(on) { this.covered = on; }

  warp(seconds, power) {
    this.warpUntil = this.time + seconds;
    this.warpPower = power;
  }

  /** `fadeIn`: segundos para a partícula surgir (0 = já nasce acesa, como numa explosão). */
  burst(x, y, { palette = [WHITE], n = 24, speed = 320, size = 2.2, life = 0.9, gravity = 160, sparkles = 0.3, petals = 0, fadeIn = 0 } = {}) {
    const total = this.reduce ? Math.ceil(n / 4) : n;
    for (let i = 0; i < total; i += 1) {
      const a = rand(0, Math.PI * 2);
      const v = speed * rand(0.3, 1);
      const l = life * rand(0.6, 1.1);
      const isPetal = Math.random() < petals;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: gravity, life: l, max: l,
        size: size * rand(0.6, 1.4), color: pick(palette), petal: isPetal, star: !isPetal && Math.random() < sparkles,
        rot: rand(0, 6.3), spin: rand(-3, 3), sway: rand(0, 6.3), fadeIn });
    }
  }

  /** Um fio de luz de um ponto a outro, numa leve curva: as partículas saem juntas e a mais rápida vai na frente. */
  stream(x0, y0, x1, y1, { palette = [WHITE], n = 12, life = 0.36, size = 2, bend = 0.16 } = {}) {
    if (this.reduce) return;
    for (let i = 0; i < n; i += 1) {
      const l = life * (0.6 + (0.4 * i) / n);
      this.parts.push({ pull: true, out: true, sx: x0, sy: y0, tx: x1, ty: y1, bx: (y0 - y1) * bend, by: (x1 - x0) * bend,
        x: x0, y: y0, life: l, max: l, size: size * (1.2 - (0.5 * i) / n), color: pick(palette), star: false });
    }
  }

  /** Partículas que vêm de longe e se juntam num ponto (a carta "puxando" energia). */
  converge(x, y, { palette = [WHITE], n = 30, radius = 260, life = 0.9, size = 2 } = {}) {
    if (this.reduce) return;
    for (let i = 0; i < n; i += 1) {
      const a = rand(0, Math.PI * 2);
      const r = radius * rand(0.6, 1.1);
      const l = life * rand(0.55, 1);
      this.parts.push({ pull: true, sx: x + Math.cos(a) * r, sy: y + Math.sin(a) * r, tx: x, ty: y, x, y,
        life: l, max: l, size: size * rand(0.7, 1.3), color: pick(palette), star: false });
    }
  }

  ring(x, y, { color = WHITE, rainbow = false, radius = 260, life = 0.7, width = 6, delay = 0 } = {}) {
    this.rings.push({ x, y, color, rainbow, radius, life, max: life, width, delay });
  }

  frame(now) {
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    this.time += dt;
    const warping = this.time < this.warpUntil && !this.reduce;
    const target = this.reduce ? 0.02 : warping ? this.warpPower : 0.04 + this.level * 0.55;
    this.speed += (target - this.speed) * (1 - Math.exp(-dt * (warping ? 9 : 3.5)));
    const k = 1 - Math.exp(-dt * 4);
    for (let i = 0; i < 3; i += 1) this.tint[i] += (this.tintTo[i] - this.tint[i]) * k;
    this.rainbow += (this.rainbowTo - this.rainbow) * k;
    if (!this.covered) this.drawStars(dt);
    this.drawFx(dt);
    this.raf = requestAnimationFrame(this.frame);
  }

  drawStars(dt) {
    const ctx = this.back;
    const { w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h * 0.46;
    const fx = w * 0.55;
    const fy = h * 0.55;
    const sp = this.speed;
    const streak = Math.min(1, Math.max(0, (sp - 0.18) / 1.4));
    const tint = this.tint.map(Math.round);
    ctx.lineCap = 'round';
    for (const s of this.stars) {
      s.z -= sp * dt;
      const sx = cx + (s.x / s.z) * fx;
      const sy = cy + (s.y / s.z) * fy;
      if (s.z < 0.05 || sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) {
        Object.assign(s, this.star(1));
        continue;
      }
      const near = 1 - s.z;
      const twinkle = this.reduce ? 1 : 0.7 + 0.3 * Math.sin(this.time * 2.3 + s.tw);
      const alpha = Math.min(1, 0.1 + near * 1.2) * twinkle;
      const r = 0.35 + near * near * 2.3;
      const color = this.rainbow > 0.5
        ? `hsla(${Math.round(Math.atan2(s.y, s.x) * 57.3 + this.time * 140)}, 100%, 76%, ${alpha})`
        : rgba(tint, alpha);
      if (streak > 0.02) {
        const z2 = s.z + sp * 0.07 * streak + 0.003;
        ctx.strokeStyle = color;
        ctx.lineWidth = r * 1.4;
        ctx.beginPath();
        ctx.moveTo(cx + (s.x / z2) * fx, cy + (s.y / z2) * fy);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawFx(dt) {
    const ctx = this.front;
    ctx.clearRect(0, 0, this.w, this.h);
    if (!this.parts.length && !this.rings.length) return;
    ctx.globalCompositeOperation = 'lighter';

    this.rings = this.rings.filter((r) => {
      if (r.delay > 0) { r.delay -= dt; return true; }
      r.life -= dt;
      if (r.life <= 0) return false;
      const t = 1 - r.life / r.max;
      const radius = r.radius * (1 - (1 - t) ** 3);
      ctx.lineWidth = Math.max(0.5, r.width * (1 - t));
      if (r.rainbow && ctx.createConicGradient) {
        const g = ctx.createConicGradient(this.time * 3, r.x, r.y);
        RAINBOW.forEach((c, i) => g.addColorStop(i / RAINBOW.length, rgba(c, 1 - t)));
        g.addColorStop(1, rgba(RAINBOW[0], 1 - t));
        ctx.strokeStyle = g;
      } else {
        ctx.strokeStyle = rgba(r.rainbow ? TONE[5] : r.color, 1 - t);
      }
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      return true;
    });

    this.parts = this.parts.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) return false;
      const k = p.life / p.max;
      let alpha;
      let size;
      if (p.pull) {
        const t = 1 - k;
        if (p.out) {
          // Fio de luz: sai rápido, freia ao chegar e apaga no destino.
          const e = 1 - (1 - t) ** 2;
          const arc = Math.sin(Math.PI * e);
          p.x = p.sx + (p.tx - p.sx) * e + p.bx * arc;
          p.y = p.sy + (p.ty - p.sy) * e + p.by * arc;
          alpha = Math.min(1, k * 4);
          size = p.size;
        } else {
          const e = t * t * t; // acelera ao chegar
          p.x = p.sx + (p.tx - p.sx) * e;
          p.y = p.sy + (p.ty - p.sy) * e;
          alpha = Math.min(1, t * 2.5);
          size = p.size * (0.5 + t);
        }
      } else {
        const drag = Math.exp(-2.4 * dt);
        p.vx *= drag;
        p.vy = p.vy * drag + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        alpha = Math.min(1, k * 1.8);
        if (p.fadeIn) alpha *= Math.min(1, (p.max - p.life) / p.fadeIn);
        size = p.size * (0.35 + 0.65 * k);
      }
      if (p.petal) {
        // Pétalas planam: giram devagar e balançam de um lado para o outro enquanto caem.
        p.rot += dt * p.spin;
        p.x += Math.sin(this.time * 2.4 + p.sway) * 26 * dt;
        petal(ctx, p.x, p.y, p.size * 2.6, p.rot, rgba(p.color, Math.min(1, alpha * 1.15)));
      } else if (p.star) {
        p.rot += dt * 4;
        sparkle(ctx, p.x, p.y, size * 3.2, p.rot, rgba(p.color, alpha));
      } else {
        ctx.fillStyle = rgba(p.color, alpha * 0.22);
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba(p.color, alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      return true;
    });
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ------------------------------------------------------------- HTML

function ticketHtml(count, banner, serial) {
  const face = `
    <span class="tk-face">
      <span class="tk-body">
        <span class="tk-brand"><b>UmaWorld</b><span>Templo da Sorte</span></span>
        <span class="tk-title">Bilhete de Recrutamento</span>
        <span class="tk-banner">${esc(banner.name)}</span>
        <span class="tk-foot"><span>Nº ${String(serial).padStart(6, '0')}</span>
          <span>${count > 1 ? `Vale ${count} recrutamentos` : 'Vale 1 recrutamento'}</span></span>
        <span class="tk-mark">${icon('horseshoe')}</span>
      </span>
      <span class="tk-stub">
        <span class="tk-count"><small>x</small>${count}</span>
        <span class="tk-admit">Entrada</span>
        <span class="tk-code"></span>
      </span>
      <i class="tk-perf"></i>
      <i class="tk-holo"></i>
    </span>`;
  const ghosts = count > 1 ? '<span class="tk-ghost g2"></span><span class="tk-ghost g1"></span>' : '';
  return `
    <div class="ticket-wrap" data-wrap>
      ${ghosts}
      <div class="ticket" data-ticket role="button" tabindex="0" aria-label="Rasgar o bilhete">
        <span class="tk-whole">${face}</span>
        <span class="tk-part tk-main">${face}</span>
        <span class="tk-part tk-cut">${face}</span>
        <span class="tk-seam"></span>
      </div>
    </div>`;
}

/** Borda serrilhada do rasgo (sorteada a cada pull), usada pelas duas metades. */
function tearEdge() {
  const n = 18;
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const jag = i === 0 || i === n ? 0 : (i % 2 ? 1 : -1) * rand(0.5, 1.6);
    pts.push(`${(SEAM + jag).toFixed(2)}% ${((i / n) * 100).toFixed(2)}%`);
  }
  return pts.join(', ');
}

const cardLabel = (r) => `${r.character.name}, ${r.rarity} estrelas${r.outcome === 'new' ? ', nova' : ''}`;

function cardHtml(r, i) {
  const c = r.character;
  return `
    <button class="rcard r${r.rarity}" type="button" data-card="${i}" aria-label="Carta ${i + 1}, virada para baixo">
      <span class="rc-flip">
        <span class="rc-back">${icon('horseshoe')}</span>
        <span class="rc-face">
          <span class="rc-art" style="--c:${esc(c.color)};--c2:${esc(c.color2 || c.color)}">
            <span class="rc-ini">${esc(initials(c.name))}</span>
            ${c.img ? `<img src="${umaImg(c.id, 'card')}" alt="" decoding="async" draggable="false" onerror="this.remove()">` : ''}
            ${r.featured ? `<span class="rc-flag" title="Destaque">${icon('target')}</span>` : ''}
            ${r.outcome === 'new' ? '<span class="rc-new">NOVA</span>' : ''}
          </span>
          <span class="rc-body">
            ${stars(r.rarity)}
            <span class="rc-name">${esc(c.name)}</span>
            <span class="rc-meta">${r.outcome === 'new' ? `${esc(c.distance_label)} · ${esc(c.style_label)}` : OUTCOME[r.outcome](r)}</span>
          </span>
        </span>
      </span>
    </button>`;
}

function spotHtml(r) {
  const c = r.character;
  const tags = [OUTCOME_CHIP[r.outcome](r)];
  if (r.featured) tags.push(`<span class="chip chip-gold">${icon('target')}Destaque</span>`);
  if (r.rarity === 5) tags.push(`<span class="chip">${r.pity} pity</span>`);
  return `
    <div class="spot r${r.rarity}" style="--c:${esc(c.color)};--c2:${esc(c.color2 || c.color)}" tabindex="-1"
         role="dialog" aria-label="${esc(cardLabel(r))}">
      <div class="spot-bg"></div>
      <div class="spot-rays"></div>
      <div class="spot-band"></div>
      <div class="spot-art">${c.img
        ? `<img src="${umaImg(c.id, 'full')}" alt="${esc(c.name)}" decoding="async" draggable="false">`
        : portrait(c, 220)}</div>
      <div class="spot-info">
        <div class="spot-stars r${r.rarity}">${`<span class="spot-star">${icon('star')}</span>`.repeat(r.rarity)}</div>
        <h2 class="spot-name">${esc(c.name)}</h2>
        <p class="spot-sub">${esc(c.distance_label)} · ${esc(c.style_label)}</p>
        <div class="spot-tags">${tags.join('')}</div>
      </div>
      <p class="spot-hint">Toque para continuar</p>
    </div>`;
}

function tallyHtml(results) {
  const count = (n) => results.filter((r) => r.rarity === n).length;
  const news = results.filter((r) => r.outcome === 'new').length;
  return [5, 4, 3].filter((n) => count(n))
    .map((n) => `<span class="rv-chip r${n}">${count(n)}× ${n}${icon('star')}</span>`).join('')
    + (news ? `<span class="rv-chip new">${icon('sparkle')}${news} ${news > 1 ? 'novas' : 'nova'}</span>` : '');
}

function paidHtml(paid) {
  const parts = [];
  if (paid?.tickets) parts.push(money('tickets', paid.tickets));
  if (paid?.carats) parts.push(money('carats', paid.carats));
  return parts.length ? `<span class="rv-paid">Pago com ${parts.join('<span class="plus">+</span>')}</span>` : '';
}

/** Carrega e decodifica as artes antes do rasgo (no máximo `ms`, para não travar numa rede lenta). */
function preloadImages(results, keep, ms = 3500) {
  const load = (src) => {
    const img = new Image();
    img.src = src;
    keep.push(img); // segura a imagem no cache enquanto a revelação existir
    return img.decode().catch(() => {});
  };
  const waits = [];
  for (const r of results) {
    if (!r.character.img) continue;
    waits.push(load(umaImg(r.character.id, 'card')));
    if (r.rarity === 5) waits.push(load(umaImg(r.character.id, 'full')));
    else if (r.rarity === 4) load(umaImg(r.character.id, 'full')); // em segundo plano, para o toque na carta
  }
  return Promise.race([Promise.all(waits), new Promise((resolve) => { setTimeout(resolve, ms); })]);
}

// ------------------------------------------------------------- revelação

/**
 * Abre a revelação já no clique: o bilhete entra enquanto o servidor sorteia.
 * `play(results, paid)` entrega o resultado e resolve quando o jogador fecha;
 * `cancel()` fecha na hora (pull recusado pelo servidor).
 */
export function openReveal({ count, banner, serial = 1 }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = (ms) => (reduce ? Math.min(ms, 80) : ms);
  const app = document.getElementById('app');

  let alive = true;
  let phase = 'ticket';
  let results = null;
  let paid = null;
  let preload = Promise.resolve();
  let tearAsked = false;
  let skipAsked = false;
  let cards = [];
  let spot = null;
  let spotChain = Promise.resolve();
  const timers = new Set();
  const keep = [];

  const wait = (ms) => new Promise((resolve) => {
    const id = setTimeout(() => { timers.delete(id); resolve(); }, T(ms));
    timers.add(id);
  });
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, T(ms));
    timers.add(id);
  };

  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });
  let resolveTear;
  const tearRequested = new Promise((r) => { resolveTear = r; });

  const root = document.createElement('div');
  root.className = 'reveal';
  root.tabIndex = -1;
  root.dataset.phase = 'ticket';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Revelação do recrutamento');
  root.innerHTML = `
    <canvas class="rv-sky" aria-hidden="true"></canvas>
    <div class="rv-nebula" aria-hidden="true"><i class="n3"></i><i class="n4"></i><i class="n5"></i></div>
    <div class="rv-stage" data-stage>
      ${ticketHtml(count, banner, serial)}
      <p class="rv-hint" data-hint>Toque no bilhete para rasgar</p>
    </div>
    <canvas class="rv-fx" aria-hidden="true"></canvas>
    <div class="rv-flash" aria-hidden="true"></div>
    <div class="rv-top">
      <span class="rv-banner">${icon('gacha')}<span>${esc(banner.name)}</span></span>
      <button class="rv-skip" type="button" data-skip>Pular${icon('next')}</button>
    </div>
    <p class="sr-only" aria-live="polite" data-live></p>`;
  document.body.appendChild(root);
  if (app) app.inert = true;

  const sky = new Sky(root.querySelector('.rv-sky'), root.querySelector('.rv-fx'), reduce);
  sky.start();
  const ticket = root.querySelector('[data-ticket]');
  ticket.focus({ preventScroll: true });

  const setPhase = (p) => { phase = p; root.dataset.phase = p; };
  const hint = (text) => { const el = root.querySelector('[data-hint]'); if (el) el.textContent = text; };

  function setTone(r) {
    root.dataset.tone = r ? `r${r}` : '';
    sky.tone(r ? TONE[r] : STARLIGHT, r === 5);
  }

  function flash(peak = 1, ms = 520) {
    root.querySelector('.rv-flash').animate(
      [{ opacity: 0 }, { opacity: peak, offset: 0.16 }, { opacity: 0 }],
      { duration: T(ms), easing: 'ease-out' },
    );
  }

  function shake() {
    if (reduce) return;
    root.classList.remove('shake');
    void root.offsetWidth; // reinicia a animação
    root.classList.add('shake');
    later(() => root.classList.remove('shake'), 480);
  }

  // ----------------------------------------------------------- bilhete

  let drag = null;
  ticket.addEventListener('pointerdown', (e) => {
    if (phase !== 'ticket' || tearAsked) return;
    drag = { x: e.clientX, y: e.clientY };
    ticket.setPointerCapture?.(e.pointerId);
  });
  ticket.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pull = Math.min(1, Math.hypot(e.clientX - drag.x, e.clientY - drag.y) / 120);
    ticket.style.setProperty('--pull', pull.toFixed(3));
  });
  ticket.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = null;
    ticket.style.setProperty('--pull', '0');
    askTear();
  });
  ticket.addEventListener('pointercancel', () => {
    drag = null;
    ticket.style.setProperty('--pull', '0');
  });

  function askTear() {
    if (tearAsked || !alive) return;
    tearAsked = true;
    ticket.classList.add('primed');
    if (!results) {
      ticket.classList.add('waiting');
      hint('Consultando a sorte…');
    }
    resolveTear();
  }

  async function charge(best) {
    setPhase('charge');
    hint('');
    ticket.classList.remove('waiting');
    ticket.classList.add('charging');
    const c = centerOf(ticket);
    const far = Math.max(window.innerWidth, window.innerHeight);
    setTone(3);
    sky.charge(0.25);
    await wait(best === 3 ? 820 : 600);
    if (!alive || skipAsked) return;
    if (best >= 4) {
      setTone(4);
      sky.charge(0.45);
      sky.ring(c.x, c.y, { color: TONE[4], radius: Math.min(400, far * 0.4), life: 0.8, width: 5 });
      sky.burst(c.x, c.y, { palette: [TONE[4], WHITE], n: 22, speed: 300 });
      await wait(best === 4 ? 700 : 560);
      if (!alive || skipAsked) return;
    }
    if (best === 5) {
      setTone(5);
      ticket.classList.add('holo');
      sky.charge(0.75);
      flash(0.85, 560);
      shake();
      sky.ring(c.x, c.y, { rainbow: true, radius: far * 0.6, life: 1.1, width: 12 });
      sky.burst(c.x, c.y, { palette: RAINBOW, n: 70, speed: 520, sparkles: 0.5 });
      await wait(1400);
    }
  }

  async function tear(best) {
    setPhase('tear');
    const [main, cut] = ticket.querySelectorAll('.tk-part');
    const edge = tearEdge();
    main.style.clipPath = `polygon(0 0, ${edge}, 0 100%)`;
    cut.style.clipPath = `polygon(${edge}, 100% 100%, 100% 0)`;
    ticket.classList.remove('charging', 'primed');
    ticket.classList.add('torn');

    const rect = ticket.getBoundingClientRect();
    const seam = { x: rect.left + (rect.width * SEAM) / 100, y: rect.top + rect.height / 2 };
    const palette = best === 5 ? RAINBOW : [TONE[best], WHITE];
    const fly = { duration: T(900), easing: 'cubic-bezier(.25,.7,.35,1)', fill: 'forwards' };
    main.animate([
      { transform: 'none', opacity: 1 },
      { transform: 'translate(-3%, 4%) rotate(-5deg)', opacity: 1, offset: 0.3 },
      { transform: 'translate(-12%, 38%) rotate(-14deg)', opacity: 0 },
    ], fly);
    cut.animate([
      { transform: 'none', opacity: 1 },
      { transform: 'translate(7%, -9%) rotate(12deg)', opacity: 1, offset: 0.3 },
      { transform: 'translate(30%, -70%) rotate(40deg)', opacity: 0 },
    ], fly);
    sky.burst(seam.x, seam.y, { palette, n: best === 5 ? 110 : 50, speed: 640, sparkles: best === 5 ? 0.5 : 0.25 });
    sky.ring(seam.x, seam.y, { color: TONE[best], rainbow: best === 5, life: 0.9, width: 14,
      radius: Math.max(window.innerWidth, window.innerHeight) * 0.7 });
    sky.warp(1.1, best === 5 ? 3.4 : 2.6);
    await wait(140);
    flash(1, 760);
    await wait(380);
  }

  // ----------------------------------------------------------- cartas

  function showTable(instant) {
    setPhase('cards');
    setTone(0);
    sky.charge(0);
    const n = results.length;
    const lg = n <= 5 ? n : Math.ceil(n / 2);
    const sm = n <= 4 ? n : n <= 6 || n === 9 ? 3 : 4;
    const stage = root.querySelector('[data-stage]');
    stage.innerHTML = `
      <div class="rv-table ${n === 1 ? 'single' : ''}">
        <div class="rv-head">
          <h2 class="rv-title">${n > 1 ? `Recrutamento ${n}x` : 'Recrutamento'}</h2>
          <div class="rv-tally" data-tally></div>
        </div>
        <div class="rv-cards" style="--cols-lg:${lg};--cols-sm:${sm}">${results.map(cardHtml).join('')}</div>
        <div class="rv-actions" data-actions hidden>
          ${paidHtml(paid)}
          <button class="btn btn-primary btn-lg" type="button" data-close>Continuar</button>
        </div>
      </div>`;
    cards = [...stage.querySelectorAll('.rcard')].map((el, i) => ({ el, i, r: results[i], rarity: results[i].rarity, state: 'down' }));
    if (instant) {
      cards.forEach((c) => {
        c.state = 'up';
        c.el.classList.add('up');
        c.el.setAttribute('aria-label', cardLabel(c.r));
      });
      finish();
      return;
    }
    deal();
  }

  /** As cartas saem do ponto do rasgo e voam para os lugares (FLIP). */
  function deal() {
    const from = { x: window.innerWidth / 2, y: window.innerHeight * 0.46 };
    cards.forEach((c, i) => {
      const to = centerOf(c.el);
      const rot = rand(-14, 14);
      c.el.animate([
        { transform: `translate(${from.x - to.x}px, ${from.y - to.y}px) rotate(${rot}deg) scale(.5)`, opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { transform: 'none', opacity: 1 },
      ], { duration: T(520), delay: T(i * 60), easing: 'cubic-bezier(.2,.9,.3,1.12)', fill: 'backwards' });
    });
  }

  async function autoReveal() {
    await wait(560 + cards.length * 60);
    for (const card of cards) {
      await spotChain; // espera um destaque aberto pelo toque do jogador
      if (!alive || skipAsked) return;
      if (card.state !== 'down') continue;
      if (card.rarity === 3) {
        reveal(card); // 3★ viram em onda, uma emendando na outra
        await wait(150);
      } else {
        await reveal(card);
        await wait(180);
      }
    }
  }

  async function chargeCard(card) {
    const c = centerOf(card.el);
    card.el.classList.add('charging');
    if (card.rarity === 5) {
      root.classList.add('focus');
      card.el.classList.add('lifted');
      sky.converge(c.x, c.y, { palette: RAINBOW, n: 48, radius: 300, life: 0.95 });
      await wait(380);
      card.el.classList.add('holo');
      sky.ring(c.x, c.y, { rainbow: true, radius: 150, life: 0.6, width: 4 });
      await wait(720);
    } else {
      sky.converge(c.x, c.y, { palette: [TONE[4], WHITE], n: 18, radius: 170, life: 0.5 });
      await wait(520);
    }
    card.el.classList.remove('charging');
  }

  /** Virada em duas metades: a frente só aparece com a carta de perfil, sem truque de verso 3D. */
  async function flip(card, fast) {
    const inner = card.el.querySelector('.rc-flip');
    const half = inner.animate(
      [{ transform: 'perspective(900px) rotateY(0deg)' }, { transform: 'perspective(900px) rotateY(90deg)' }],
      { duration: T(fast ? 110 : 170), easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' },
    );
    await half.finished.catch(() => {});
    card.el.classList.add('up');
    inner.animate(
      [{ transform: 'perspective(900px) rotateY(-90deg)' }, { transform: 'perspective(900px) rotateY(0deg)' }],
      { duration: T(fast ? 170 : 280), easing: 'cubic-bezier(.2,.9,.3,1.25)' },
    );
    half.cancel();
  }

  function glint(card) {
    const g = document.createElement('i');
    g.className = 'rc-glint';
    card.el.appendChild(g);
    g.animate([{ opacity: 0.95, transform: 'scale(.9)' }, { opacity: 0, transform: 'scale(1.35)' }],
      { duration: T(560), easing: 'ease-out', fill: 'forwards' })
      .finished.catch(() => {}).then(() => g.remove());
  }

  function cardFx(card, big) {
    const c = centerOf(card.el);
    if (card.rarity === 5) {
      const far = Math.max(window.innerWidth, window.innerHeight);
      glint(card);
      sky.ring(c.x, c.y, { rainbow: true, radius: big ? far * 0.55 : 220, life: big ? 1.1 : 0.7, width: big ? 12 : 6 });
      sky.burst(c.x, c.y, { palette: RAINBOW, n: big ? 90 : 30, speed: big ? 620 : 380, sparkles: 0.5 });
      if (big) {
        sky.ring(c.x, c.y, { color: WHITE, radius: 260, life: 0.55, width: 5, delay: 0.06 });
        shake();
        try { navigator.vibrate?.([30, 50, 80]); } catch { /* sem vibração */ }
      }
    } else if (card.rarity === 4) {
      glint(card);
      sky.ring(c.x, c.y, { color: TONE[4], radius: 190, life: 0.6, width: 5 });
      sky.burst(c.x, c.y, { palette: [TONE[4], WHITE], n: 22, speed: 340 });
    } else {
      sky.burst(c.x, c.y, { palette: [TONE[3], WHITE], n: 8, speed: 170, size: 1.6, life: 0.6 });
    }
  }

  async function reveal(card, fast = false) {
    if (card.state !== 'down' || !alive) return;
    card.state = 'busy';
    const big = card.rarity === 5 && !fast;
    if (card.rarity >= 4 && !fast) await chargeCard(card);
    if (!alive) return;
    await flip(card, fast || skipAsked);
    if (!alive) return;
    card.el.setAttribute('aria-label', cardLabel(card.r));
    cardFx(card, big && !skipAsked);
    if (big && !skipAsked) {
      await wait(320);
      if (alive && !skipAsked) await openSpot(card, true);
    }
    card.state = 'up'; // só depois do destaque: a mesa não "termina" com uma 5★ ainda por mostrar
    card.el.classList.remove('lifted', 'holo');
    if (!cards.some((c) => c.el.classList.contains('lifted'))) root.classList.remove('focus');
    if (cards.every((c) => c.state === 'up')) finish();
  }

  // ----------------------------------------------------------- destaque (arte grande)

  function openSpot(card, burst = false) {
    const run = spotChain.then(() => showSpot(card, burst));
    spotChain = run.catch(() => {});
    return run;
  }

  function shards(c) {
    if (reduce) return;
    const far = Math.max(window.innerWidth, window.innerHeight);
    for (let i = 0; i < 16; i += 1) {
      const s = document.createElement('i');
      s.className = 'shard';
      const size = rand(26, 84);
      const pts = Array.from({ length: 3 }, () => `${rand(0, 100).toFixed(0)}% ${rand(0, 100).toFixed(0)}%`);
      s.style.cssText = `left:${c.x}px;top:${c.y}px;width:${size}px;height:${size}px;clip-path:polygon(${pts.join(',')})`;
      root.appendChild(s);
      const a = rand(0, Math.PI * 2);
      const d = rand(180, far * 0.6);
      s.animate([
        { transform: 'translate(-50%, -50%) scale(.3) rotate(0deg)', opacity: 1 },
        { opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${(Math.cos(a) * d).toFixed(0)}px), calc(-50% + ${(Math.sin(a) * d).toFixed(0)}px)) scale(1) rotate(${rand(-260, 260).toFixed(0)}deg)`, opacity: 0 },
      ], { duration: rand(650, 1100), easing: 'cubic-bezier(.1,.75,.3,1)', fill: 'forwards' })
        .finished.catch(() => {}).then(() => s.remove());
    }
  }

  function showSpot(card, burst) {
    return new Promise((resolve) => {
      if (!alive) { resolve(); return; }
      const r = card.r;
      const el = toElement(spotHtml(r));
      root.appendChild(el);
      const art = el.querySelector('.spot-art');

      // A arte "sai" da carta: começa do tamanho e lugar dela e cresce até o centro.
      const toCard = () => {
        const a = card.el.getBoundingClientRect();
        const b = art.getBoundingClientRect();
        const dx = a.left + a.width / 2 - (b.left + b.width / 2);
        const dy = a.top + a.height / 2 - (b.top + b.height / 2);
        return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${Math.max(0.1, a.height / Math.max(1, b.height)).toFixed(3)})`;
      };
      el.querySelector('.spot-bg').animate([{ opacity: 0 }, { opacity: 1 }], { duration: T(260), fill: 'backwards' });
      el.querySelector('.spot-rays').animate([{ opacity: 0 }, { opacity: 1 }], { duration: T(700), fill: 'backwards' });
      el.querySelector('.spot-band').animate([{ transform: 'scaleX(0)' }, { transform: 'none' }],
        { duration: T(520), delay: T(120), easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
      art.animate([
        { transform: toCard(), opacity: 0, filter: 'brightness(3)' },
        { opacity: 1, offset: 0.25 },
        { transform: 'none', opacity: 1, filter: 'brightness(1)' },
      ], { duration: T(680), easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'backwards' });
      if (burst) shards(centerOf(card.el));

      el.querySelectorAll('.spot-star').forEach((s, i) => s.animate([
        { transform: 'scale(0) rotate(-60deg)', opacity: 0 },
        { transform: 'scale(1.4) rotate(8deg)', opacity: 1, offset: 0.6 },
        { transform: 'none', opacity: 1 },
      ], { duration: T(360), delay: T(420 + i * 110), easing: 'ease-out', fill: 'backwards' }));
      const rise = (sel, delay) => el.querySelector(sel).animate(
        [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }],
        { duration: T(420), delay: T(delay), easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' },
      );
      rise('.spot-name', 300);
      rise('.spot-sub', 420);
      rise('.spot-tags', 560 + r.rarity * 110);
      el.querySelector('.spot-hint').animate([{ opacity: 0 }, { opacity: 0.8 }],
        { duration: T(300), delay: T(1100), fill: 'backwards' });

      let closing = false;
      const close = () => {
        if (closing) return;
        closing = true;
        if (spot?.el === el) spot = null;
        art.animate([{ transform: 'none', opacity: 1 }, { transform: toCard(), opacity: 0 }],
          { duration: T(380), easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(380), easing: 'ease-in', fill: 'forwards' })
          .finished.catch(() => {}).then(() => {
            el.remove();
            // Foco na própria revelação (não na carta), para o próximo Enter avançar em vez de reabrir o destaque.
            if (alive) (phase === 'done' ? root.querySelector('[data-close]') : root).focus({ preventScroll: true });
            resolve();
          });
      };
      spot = { el, close };
      el.addEventListener('click', close);
      el.focus({ preventScroll: true });
    });
  }

  // ----------------------------------------------------------- fim, pular e fechar

  function finish() {
    if (phase === 'done' || !alive) return;
    setPhase('done');
    root.querySelector('[data-tally]').innerHTML = tallyHtml(results);
    const actions = root.querySelector('[data-actions]');
    actions.hidden = false;
    actions.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: T(320), easing: 'ease-out' });
    root.querySelector('[data-skip]').hidden = true;
    if (!spot) actions.querySelector('[data-close]').focus({ preventScroll: true });
    root.querySelector('[data-live]').textContent = `Resultado: ${results.map(cardLabel).join('; ')}.`;
  }

  function skipAll() {
    if (!alive) return;
    if (phase === 'done') { close(); return; }
    skipAsked = true;
    if (phase === 'ticket' || phase === 'charge' || phase === 'tear') {
      resolveTear(); // o fluxo principal vê o pedido e monta a mesa já revelada
      return;
    }
    spot?.close();
    cards.filter((c) => c.state === 'down').forEach((c, i) => later(() => reveal(c, true), i * 45));
    if (cards.every((c) => c.state === 'up')) finish();
  }

  function close() {
    if (!alive) return;
    alive = false;
    timers.forEach(clearTimeout);
    timers.clear();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', close);
    if (app) app.inert = false;
    root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(240), fill: 'forwards' })
      .finished.catch(() => {}).then(() => { sky.stop(); root.remove(); });
    resolveDone();
  }

  function onKey(e) {
    if (!alive) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (spot) spot.close();
      else skipAll();
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (spot) { e.preventDefault(); spot.close(); return; }
      if (e.target instanceof Element && e.target.closest('button')) return; // botões já respondem sozinhos
      e.preventDefault();
      if (phase === 'ticket') askTear();
      else if (phase === 'cards') { const next = cards.find((c) => c.state === 'down'); if (next) reveal(next); }
      else if (phase === 'done') close();
    }
  }
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', close);

  root.addEventListener('click', (e) => {
    if (!alive) return;
    if (e.target.closest('[data-skip]')) { skipAll(); return; }
    if (e.target.closest('[data-close]')) { close(); return; }
    if (e.target.closest('.spot')) return; // o destaque fecha sozinho
    const cardEl = e.target.closest('.rcard');
    if (cardEl) {
      const card = cards[Number(cardEl.dataset.card)];
      if (card.state === 'down') reveal(card);
      else if (card.state === 'up' && !spot) openSpot(card);
      return;
    }
    if (phase === 'ticket' && !e.target.closest('[data-ticket]')) askTear();
  });

  // ----------------------------------------------------------- fluxo principal

  (async () => {
    await Promise.all([ready, tearRequested]);
    if (!alive) return;
    if (skipAsked) { showTable(true); return; }
    const best = Math.max(...results.map((r) => r.rarity));
    await Promise.all([charge(best), preload]);
    if (!alive) return;
    if (skipAsked) { showTable(true); return; }
    await tear(best);
    if (!alive) return;
    showTable(skipAsked);
    if (!skipAsked) autoReveal();
  })();

  return {
    play(list, paidInfo) {
      if (alive) {
        results = list;
        paid = paidInfo;
        preload = preloadImages(list, keep);
        resolveReady();
      }
      return done;
    },
    cancel: close,
  };
}
