// Revelações de uma personagem só, fora da mesa de cartas:
//
// - 'exchange': a troca de 200 pulls no Templo da Sorte (5★). A luz se junta num medalhão com o
//   retrato escolhido, ele se rompe num anel holográfico e a arte grande aparece.
// - 'bloom': a visitante rara da Fazenda (6★), mais longa e detalhada que a de uma 5★. Um botão de
//   flor sobe da colheita e manda um fio de luz para cada uma das seis estrelas, uma por segundo.
//   A sexta faz o céu prender a respiração, acende em arco-íris e dá um segundo choque, mais forte,
//   junto com "Uma visitante rara!". As estrelas entram no botão em espiral, ele treme e desabrocha
//   pétala por pétala (em 3D, no CSS), numa chuva de pétalas, e a personagem sai do centro da flor.
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
      <div class="bl-rays"></div>
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
  let motes = null;
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
  const flower = root.querySelector('.bl-flower');
  const captionEl = root.querySelector('[data-caption]');
  const caption = (text, rare = false) => {
    captionEl.textContent = text;
    captionEl.classList.toggle('rare', rare);
  };

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

  /** Luzinhas que sobem da colheita enquanto as estrelas acendem. */
  function startMotes() {
    if (reduce) return;
    motes = setInterval(() => {
      sky.burst(window.innerWidth * rand(0.1, 0.9), window.innerHeight * rand(0.55, 1), {
        palette: [TONE[6], PETALS[1], WHITE], n: 1, speed: 20, size: rand(1, 1.8), life: rand(2.4, 3.6),
        gravity: -120, sparkles: 0.3, fadeIn: 0.5 });
    }, 110);
  }

  const pulse = (el, k = 1.07, ms = 360) => el.animate(
    [{ transform: 'scale(1)' }, { transform: `scale(${k})`, offset: 0.3 }, { transform: 'scale(1)' }],
    { duration: T(ms), easing: 'ease-out' },
  );

  /** O botão manda um fio de luz até a estrela, e ela acende. Devolve false se a animação foi pulada. */
  async function lightStar(star, i, rainbow = false) {
    const from = centerOf(flower);
    const to = centerOf(star);
    const palette = rainbow ? RAINBOW : [TONE[6], WHITE];
    pulse(flower);
    sky.stream(from.x, from.y, to.x, to.y, { palette, n: rainbow ? 18 : 12, size: rainbow ? 2.6 : 2.2 });
    await wait(360);
    if (!alive || spot) return false;
    star.classList.remove('stir');
    star.classList.add('on');
    if (rainbow) star.classList.add('prism');
    star.querySelector('.ic').animate([
      { transform: 'scale(.3) rotate(-50deg)' },
      { transform: 'scale(1.5) rotate(10deg)', offset: 0.6 },
      { transform: 'none' },
    ], { duration: T(480), easing: 'cubic-bezier(.2,.9,.3,1.4)' });
    sky.burst(to.x, to.y, { palette, n: rainbow ? 30 : 14, speed: rainbow ? 300 : 210, size: 1.8, life: 0.75, sparkles: 0.6 });
    sky.ring(to.x, to.y, { color: TONE[6], rainbow, radius: rainbow ? 96 : 64, life: 0.55, width: rainbow ? 4 : 3 });
    sky.charge(0.1 + (i + 1) * 0.07);
    anchor.style.setProperty('--glow', ((i + 1) / 6).toFixed(2));
    return true;
  }

  /** A sexta estrela: o céu prende a respiração, ela acende em arco-íris e, um instante depois, choca de novo. */
  async function lightSixth(star, stars) {
    const to = centerOf(star);
    const ic = star.querySelector('.ic');
    anchor.classList.add('expect'); // as cinco acesas pulsam juntas
    star.classList.add('stir');
    const tremble = ic.animate([{ translate: '-1.5px .5px' }, { translate: '1.5px -1px' }],
      { duration: 70, iterations: reduce ? 1 : Infinity, direction: 'alternate' });
    sky.charge(0.5);
    sky.converge(to.x, to.y, { palette: RAINBOW, n: 40, radius: 150, life: 0.85, size: 1.8 });
    await wait(640);
    tremble.cancel();
    if (!alive || spot || !(await lightStar(star, 5, true))) return false;
    flash(0.25, 380);
    sky.charge(0.22);
    // Ela encolhe e esquenta até ficar branca...
    ic.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(.76)', filter: 'brightness(2.3)' }],
      { duration: T(460), delay: T(480), easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
    await wait(940);
    if (!alive || spot) return false;

    // ...e choca de novo, mais forte que todas: é a visitante rara.
    ic.getAnimations().forEach((a) => a.cancel());
    anchor.classList.remove('expect');
    star.classList.add('strong');
    ic.animate([
      { transform: 'scale(.76)', filter: 'brightness(2.3)' },
      { transform: 'scale(2.1)', filter: 'brightness(2.8)', offset: 0.22 },
      { transform: 'scale(.92)', filter: 'brightness(1.3)', offset: 0.55 },
      { transform: 'scale(1)', filter: 'brightness(1)' },
    ], { duration: T(900), easing: 'ease-out' });
    const far = Math.max(window.innerWidth, window.innerHeight);
    sky.ring(to.x, to.y, { rainbow: true, radius: far * 0.75, life: 1.3, width: 16 });
    sky.ring(to.x, to.y, { color: WHITE, radius: far * 0.4, life: 0.8, width: 6, delay: 0.07 });
    sky.burst(to.x, to.y, { palette: RAINBOW, n: 70, speed: 560, size: 2, life: 1.1, sparkles: 0.6 });
    sky.tone(TONE[6], true);
    sky.charge(0.6);
    root.classList.add('lit');
    flash(0.7, 620);
    shake();
    caption('Uma visitante rara!', true);
    try { navigator.vibrate?.([30, 60, 90]); } catch { /* sem vibração */ }
    // O choque passa pelas outras estrelas, das vizinhas até a do lado oposto.
    stars.forEach((s, i) => {
      if (s === star) return;
      const steps = Math.min(Math.abs(i - 5), 6 - Math.abs(i - 5));
      later(() => {
        const p = centerOf(s);
        s.querySelector('.ic').animate([
          { transform: 'scale(1)', filter: 'brightness(1)' },
          { transform: 'scale(1.5)', filter: 'brightness(2)', offset: 0.3 },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ], { duration: T(560), easing: 'ease-out' });
        sky.burst(p.x, p.y, { palette: [TONE[6], WHITE, ...RAINBOW], n: 8, speed: 180, size: 1.6, life: 0.6, sparkles: 0.7 });
      }, 60 + steps * 90);
    });
    // E segue batendo como um coração enquanto a mensagem fica na tela.
    if (!reduce) {
      ic.animate([
        { transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: 0.12 }, { transform: 'scale(1)', offset: 0.26 },
        { transform: 'scale(1.09)', offset: 0.38 }, { transform: 'scale(1)', offset: 0.55 }, { transform: 'scale(1)' },
      ], { duration: 1000, delay: 900, iterations: Infinity, easing: 'ease-out' });
      later(() => sky.ring(to.x, to.y, { rainbow: true, radius: 120, life: 0.7, width: 3 }), 900);
    }
    return true;
  }

  async function playBloom() {
    const stars = [...root.querySelectorAll('.bl-star')];
    sky.tone(TONE[6]);
    sky.charge(0.08);
    startMotes();
    await wait(1100); // o botão sobe da colheita
    for (const [i, star] of stars.entries()) {
      if (i === stars.length - 1) {
        if (!(await lightSixth(star, stars))) return;
        await wait(1250);
      } else {
        if (!(await lightStar(star, i))) return;
        await wait(640); // uma estrela por segundo
      }
    }
    if (!alive || spot) return;

    // As estrelas entram no botão em espiral, deixando um rastro de luz.
    caption('');
    const core = centerOf(flower);
    stars.forEach((s) => s.querySelector('.ic').getAnimations().forEach((a) => a.cancel()));
    anchor.classList.add('gather');
    stars.forEach((s, i) => later(() => {
      const p = centerOf(s);
      sky.stream(p.x, p.y, core.x, core.y, { palette: i === 5 ? RAINBOW : [TONE[6], WHITE], n: 10, life: 0.8,
        size: 1.8, bend: 0.32 });
    }, i * 60));
    await wait(1000);
    if (!alive || spot) return;

    // O botão absorve a luz, incha e treme, prestes a abrir.
    pulse(flower, 1.14, 420);
    anchor.classList.add('charging');
    sky.converge(core.x, core.y, { palette: [...PETALS, ...RAINBOW], n: 80, radius: 360, life: 1 });
    sky.charge(0.95);
    await wait(850);
    if (!alive || spot) return;

    // Desabrocha: cada pétala deita no seu tempo e solta pétalas pequenas pela ponta.
    clearInterval(motes);
    anchor.classList.remove('charging');
    anchor.classList.add('open');
    sky.charge(0.35);
    flash(0.3, 700);
    const far = Math.max(window.innerWidth, window.innerHeight);
    sky.ring(core.x, core.y, { color: TONE[6], radius: far * 0.32, life: 1.1, width: 5 });
    const tip = flower.offsetWidth * 0.62;
    for (let i = 0; i < 6; i += 1) {
      later(() => {
        const a = (i * Math.PI) / 3;
        sky.burst(core.x + Math.sin(a) * tip, core.y - Math.cos(a) * tip,
          { palette: PETALS, n: 4, speed: 90, size: 2.2, life: 1.5, gravity: 40, petals: 1 });
      }, 420 + i * 85);
    }
    await wait(1300);
    if (!alive || spot) return;

    // Aberta: a explosão de pétalas e a dobra; a personagem sai do centro da flor.
    flash(0.85, 820);
    shake();
    sky.ring(core.x, core.y, { rainbow: true, radius: far * 0.7, life: 1.3, width: 14 });
    sky.ring(core.x, core.y, { color: TONE[6], radius: far * 0.45, life: 0.9, width: 6, delay: 0.08 });
    sky.burst(core.x, core.y, { palette: PETALS, n: 100, speed: 640, size: 2.6, life: 2, gravity: 70, petals: 0.85 });
    sky.burst(core.x, core.y, { palette: RAINBOW, n: 50, speed: 520, sparkles: 0.6 });
    sky.warp(1.2, 3.2);
    await wait(900);
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
    clearInterval(motes);
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
    // Quando o fundo do destaque já cobre a tela, o que ficou atrás dele para de ser desenhado.
    later(() => {
      root.querySelector('[data-stage]').hidden = true;
      root.querySelector('.rv-nebula').hidden = true;
      sky.cover(true);
    }, 360);
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
    clearInterval(motes);
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
    anchor.classList.remove('charging');
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
