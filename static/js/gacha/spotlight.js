// Revelações de uma personagem só, fora da mesa de cartas:
//
// - 'exchange': a troca de 200 pulls no Templo da Sorte (5★). A luz se junta num medalhão com o
//   retrato escolhido, ele se rompe num anel holográfico e a arte grande aparece.
// - 'bloom': a visitante rara da Fazenda (6★). Um botão de flor sobe da colheita e acende seis
//   estrelas, uma a uma; a sexta é prismática. As estrelas entram na flor, ela desabrocha numa
//   chuva de pétalas e a personagem sai do centro dela.
//
// As duas usam o céu de partículas da revelação dos pulls (reveal.js) e a mesma arte de destaque.

import { esc, icon, portrait, umaImg } from '../ui.js';
import { OUTCOME_CHIP, RAINBOW, Sky, TONE, WHITE, centerOf, rand, toElement } from './reveal.js';

// Pétalas da Ramonu: verde-água, branco, lilás e um rosa claro (o "lighter" do canvas faz brilhar).
const PETALS = [[94, 233, 214], [190, 255, 246], [255, 255, 255], [203, 182, 255], [255, 190, 222]];

function spotHtml(r, tag) {
  const c = r.character;
  const tags = [OUTCOME_CHIP[r.outcome](r), `<span class="chip chip-gold">${tag}</span>`];
  return `
    <div class="spot r${r.rarity}" style="--c:${esc(c.color)};--c2:${esc(c.color2 || c.color)}" tabindex="-1"
         role="dialog" aria-label="${esc(`${c.name}, ${r.rarity} estrelas`)}">
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

function bloomHtml() {
  const stars = Array.from({ length: 6 }, (_, i) => `<span class="bl-star" style="--i:${i}">${icon('star')}</span>`).join('');
  const petals = Array.from({ length: 6 }, (_, i) => `<i class="bl-petal" style="--i:${i}"></i>`).join('');
  const inner = Array.from({ length: 6 }, (_, i) => `<i class="bl-petal inner" style="--i:${i}"></i>`).join('');
  return `
    <div class="bloom" data-anchor>
      <div class="bl-halo"></div>
      <div class="bl-ring">${stars}</div>
      <div class="bl-flower">${petals}${inner}<i class="bl-core"></i></div>
    </div>`;
}

/**
 * Mostra a revelação e resolve quando o jogador fecha.
 * `result` tem o formato de um resultado de pull: { character, rarity, outcome, awakening, fragments }.
 */
export function openSpotlight(result, { kind = 'exchange' } = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = (ms) => (reduce ? Math.min(ms, 80) : ms);
  const bloom = kind === 'bloom';
  const app = document.getElementById('app');
  const c = result.character;
  const title = bloom ? 'Visitante rara da Fazenda' : 'Troca de 200 pulls';

  let alive = true;
  let spot = null;
  let rain = null;
  const timers = new Set();
  const keep = [];
  const wait = (ms) => new Promise((resolve) => {
    const id = setTimeout(() => { timers.delete(id); resolve(); }, T(ms));
    timers.add(id);
  });

  const root = document.createElement('div');
  root.className = 'reveal spotlight';
  root.dataset.kind = kind;
  root.tabIndex = -1;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', title);
  root.innerHTML = `
    <canvas class="rv-sky" aria-hidden="true"></canvas>
    <div class="rv-nebula" aria-hidden="true"><i class="n5"></i><i class="n6"></i></div>
    <div class="rv-stage" data-stage>
      ${bloom ? bloomHtml() : `<div class="xc-orb" data-anchor>${portrait(c, 120)}</div>`}
      <p class="rv-hint" data-caption>${bloom ? 'Algo brilha no meio da colheita…' : 'Os seus 200 pulls viram uma 5★…'}</p>
    </div>
    <canvas class="rv-fx" aria-hidden="true"></canvas>
    <div class="rv-flash" aria-hidden="true"></div>
    <div class="rv-top">
      <span class="rv-banner">${icon(bloom ? 'flower' : 'exchange')}<span>${title}</span></span>
      <button class="rv-skip" type="button" data-skip>Pular${icon('next')}</button>
    </div>
    <p class="sr-only" aria-live="polite" data-live></p>`;
  document.body.appendChild(root);
  if (app) app.inert = true;
  root.focus({ preventScroll: true });

  // A arte grande já vem carregando durante a animação.
  if (c.img) {
    const img = new Image();
    img.src = umaImg(c.id, 'full');
    keep.push(img);
  }

  const sky = new Sky(root.querySelector('.rv-sky'), root.querySelector('.rv-fx'), reduce);
  sky.start();
  const anchor = root.querySelector('[data-anchor]');
  const caption = (text) => { root.querySelector('[data-caption]').textContent = text; };

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
    wait(480).then(() => root.classList.remove('shake'));
  }

  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });

  // ----------------------------------------------------------- abertura

  async function playBloom() {
    sky.tone(TONE[6]);
    sky.charge(0.12);
    await wait(950);
    const stars = [...root.querySelectorAll('.bl-star')];
    for (const [i, star] of stars.entries()) {
      if (!alive || spot) return;
      const last = i === stars.length - 1;
      star.classList.add('on');
      if (last) star.classList.add('prism');
      const p = centerOf(star);
      sky.burst(p.x, p.y, { palette: last ? RAINBOW : [TONE[6], WHITE], n: last ? 34 : 12, speed: last ? 360 : 200,
        size: 1.8, life: 0.7, sparkles: 0.6 });
      sky.charge(0.14 + i * 0.09);
      if (last) {
        sky.tone(TONE[6], true);
        root.classList.add('lit');
        flash(0.55, 480);
        shake();
        caption('Uma visitante rara!');
        try { navigator.vibrate?.([20, 40, 60]); } catch { /* sem vibração */ }
      }
      await wait(last ? 650 : 300);
    }
    if (!alive || spot) return;
    const core = centerOf(anchor);
    anchor.classList.add('gather', 'charging');
    sky.converge(core.x, core.y, { palette: [...PETALS, ...RAINBOW], n: 70, radius: 340, life: 0.95 });
    await wait(900);
    if (!alive || spot) return;
    anchor.classList.remove('charging');
    anchor.classList.add('open');
    const far = Math.max(window.innerWidth, window.innerHeight);
    flash(1, 760);
    shake();
    sky.ring(core.x, core.y, { rainbow: true, radius: far * 0.7, life: 1.2, width: 14 });
    sky.ring(core.x, core.y, { color: TONE[6], radius: far * 0.45, life: 0.9, width: 6, delay: 0.08 });
    sky.burst(core.x, core.y, { palette: PETALS, n: 90, speed: 620, size: 2.6, life: 1.9, gravity: 70, petals: 0.85 });
    sky.burst(core.x, core.y, { palette: RAINBOW, n: 50, speed: 520, sparkles: 0.6 });
    sky.warp(1.1, 3.2);
    caption('');
    await wait(720);
  }

  async function playExchange() {
    sky.tone(TONE[5]);
    sky.charge(0.25);
    await wait(500);
    if (!alive || spot) return;
    const p = centerOf(anchor);
    anchor.classList.add('charging');
    sky.converge(p.x, p.y, { palette: [TONE[5], ...RAINBOW], n: 56, radius: 300, life: 0.9 });
    await wait(820);
    if (!alive || spot) return;
    anchor.classList.remove('charging');
    anchor.classList.add('gone');
    sky.tone(TONE[5], true);
    flash(0.9, 640);
    shake();
    sky.ring(p.x, p.y, { rainbow: true, radius: Math.max(window.innerWidth, window.innerHeight) * 0.6, life: 1.1, width: 12 });
    sky.burst(p.x, p.y, { palette: RAINBOW, n: 80, speed: 560, sparkles: 0.5 });
    sky.warp(0.9, 2.8);
    caption('');
    await wait(420);
  }

  // ----------------------------------------------------------- destaque

  function showSpot() {
    if (!alive || spot) return;
    root.dataset.phase = 'spot';
    root.querySelector('[data-skip]').hidden = true;
    const el = toElement(spotHtml(result, bloom ? `${icon('flower')}Visitante rara` : `${icon('exchange')}Troca de 200 pulls`));
    root.appendChild(el);
    spot = el;
    const art = el.querySelector('.spot-art');
    const from = () => {
      const a = anchor.getBoundingClientRect();
      const b = art.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (b.left + b.width / 2);
      const dy = a.top + a.height / 2 - (b.top + b.height / 2);
      return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(.12)`;
    };
    el.querySelector('.spot-bg').animate([{ opacity: 0 }, { opacity: 1 }], { duration: T(320), fill: 'backwards' });
    el.querySelector('.spot-rays').animate([{ opacity: 0 }, { opacity: 1 }], { duration: T(800), fill: 'backwards' });
    el.querySelector('.spot-band').animate([{ transform: 'scaleX(0)' }, { transform: 'none' }],
      { duration: T(560), delay: T(140), easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
    art.animate([
      { transform: from(), opacity: 0, filter: 'brightness(3)' },
      { opacity: 1, offset: 0.25 },
      { transform: 'none', opacity: 1, filter: 'brightness(1)' },
    ], { duration: T(760), easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'backwards' });
    el.querySelectorAll('.spot-star').forEach((s, i) => s.animate([
      { transform: 'scale(0) rotate(-60deg)', opacity: 0 },
      { transform: 'scale(1.45) rotate(8deg)', opacity: 1, offset: 0.6 },
      { transform: 'none', opacity: 1 },
    ], { duration: T(380), delay: T(460 + i * 120), easing: 'ease-out', fill: 'backwards' }));
    const rise = (sel, delay) => el.querySelector(sel).animate(
      [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }],
      { duration: T(420), delay: T(delay), easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' },
    );
    rise('.spot-name', 320);
    rise('.spot-sub', 440);
    rise('.spot-tags', 560 + result.rarity * 120);
    el.querySelector('.spot-hint').animate([{ opacity: 0 }, { opacity: 0.8 }],
      { duration: T(300), delay: T(1300), fill: 'backwards' });
    root.querySelector('[data-live]').textContent = `${c.name}, ${result.rarity} estrelas.`;
    // Na 6★, as pétalas continuam caindo devagar sobre a arte.
    if (bloom && !reduce) {
      rain = setInterval(() => {
        sky.burst(rand(0, window.innerWidth), -12, { palette: PETALS, n: 1, speed: 40, size: 2.4, life: 6,
          gravity: 34, petals: 1 });
      }, 260);
    }
    el.focus({ preventScroll: true });
  }

  // ----------------------------------------------------------- fechar

  function close() {
    if (!alive) return;
    alive = false;
    timers.forEach(clearTimeout);
    timers.clear();
    clearInterval(rain);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', close);
    if (app) app.inert = false;
    root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(260), fill: 'forwards' })
      .finished.catch(() => {}).then(() => { sky.stop(); root.remove(); });
    resolveDone();
  }

  function skip() {
    timers.forEach(clearTimeout);
    timers.clear();
    anchor.classList.add('open', 'gone');
    showSpot();
  }

  function onKey(e) {
    if (!alive) return;
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (spot) close();
      else skip();
    }
  }
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', close);
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-skip]')) { skip(); return; }
    if (spot) close();
  });

  (async () => {
    await (bloom ? playBloom() : playExchange());
    showSpot();
  })();

  return done;
}
