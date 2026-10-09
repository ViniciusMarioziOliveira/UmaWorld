// Loja: ofertas por aba, com limites diários/semanais/únicos.

import { api, onState, state } from '../store.js';
import {
  act, bindSteppers, countdown, esc, fmt, icon, money, portrait, stars, stepper, toast, viewHead,
} from '../ui.js';

const LIMIT_LABEL = { daily: 'hoje', weekly: 'nesta semana', once: 'compra única' };
const TAB_ICON = { moedas: 'coin', carats: 'carat', fragmentos: 'fragment', cosmeticos: 'brush' };
const TAB_CURRENCY = { moedas: 'coins', carats: 'carats', fragmentos: 'fragments' };

export async function render(el, params, ctx) {
  let data = await api.get('/api/shop');
  if (!ctx.alive) return;
  let tab = data.tabs[params[0]] ? params[0] : 'moedas';
  const qty = {};

  function offerHtml(o) {
    const max = o.remaining ?? 99;
    const soldOut = o.owned || o.remaining === 0;
    const q = Math.max(1, Math.min(qty[o.id] || 1, max || 1));
    const affordable = state.me[o.currency] >= o.price * q;
    const limit = o.limit_period
      ? (o.limit_period === 'once' ? 'Compra única' : `Restam ${o.remaining} ${LIMIT_LABEL[o.limit_period]}`)
      : 'Sem limite';
    return `
      <article class="offer r${o.rarity} ${soldOut ? 'soldout' : ''}">
        <div class="o-art">${o.character ? portrait(o.character, 84) : icon(o.icon)}</div>
        <div class="row-between">${stars(o.rarity)}<span class="chip">${esc(limit)}</span></div>
        <h4>${esc(o.name)}</h4>
        <p class="o-desc">${o.character
          ? `${esc(o.character.distance_label)} · ${esc(o.character.style_label)}. Cópias extras viram Despertar.`
          : esc(o.description || '')}</p>
        ${!soldOut && max > 1 ? `<div class="row-between small"><span class="muted">Quantidade</span>${stepper(o.id, q, max, 1)}</div>` : ''}
        <div class="o-foot">
          <span class="price">${money(o.currency, o.price * q)}</span>
          ${soldOut
            ? `<span class="chip chip-green">${icon('check')}${o.owned ? 'Adquirido' : 'Esgotado'}</span>`
            : `<button class="btn btn-primary btn-sm" data-buy="${esc(o.id)}" ${affordable ? '' : 'disabled'}>${icon('bag')}Comprar</button>`}
        </div>
      </article>`;
  }

  function draw() {
    const offers = data.offers.filter((o) => o.tab === tab);
    const cur = TAB_CURRENCY[tab];
    el.querySelector('[data-tabs]').innerHTML = Object.entries(data.tabs).map(([id, label]) => `
      <button class="tab ${id === tab ? 'active' : ''}" data-tab="${id}">${icon(TAB_ICON[id])}${esc(label)}</button>`).join('');
    el.querySelector('[data-body]').innerHTML = `
      <div class="row-between" style="margin-bottom:14px">
        <span class="small muted row" style="gap:6px">${icon('hourglass')}Diárias renovam em <strong data-countdown="${esc(data.resets.daily)}">${countdown(data.resets.daily)}</strong>
          · semanais em <strong data-countdown="${esc(data.resets.weekly)}">${countdown(data.resets.weekly)}</strong></span>
        ${cur ? `<span class="chip chip-gold">Saldo: ${money(cur, state.me[cur])}</span>` : ''}
      </div>
      <div class="offer-grid">${offers.map(offerHtml).join('')}</div>`;
  }

  el.innerHTML = `
    ${viewHead({ icon: 'shop', tone: 'pink', title: 'Loja', sub: 'Troque moedas, carats e fragmentos por itens, equipamentos, cosméticos e personagens.' })}
    <div class="tabs" data-tabs></div>
    <section class="panel" data-body></section>`;

  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; window.history.replaceState(null, '', `#/loja/${tab}`); draw(); return; }
    const buy = e.target.closest('[data-buy]');
    if (!buy) return;
    const offer = data.offers.find((o) => o.id === buy.dataset.buy);
    const quantity = Math.max(1, Math.min(qty[offer.id] || 1, offer.remaining ?? 99));
    const res = await act(buy, () => api.post(`/api/shop/${offer.id}/buy`, { quantity }));
    if (!res || !ctx.alive) return;
    data = res.shop;
    qty[offer.id] = 1;
    draw();
    const char = res.characters[0];
    const extra = char ? (char.status === 'new' ? ' · nova personagem!' : char.status === 'awakening' ? ` · Despertar ${char.awakening}/5` : '') : '';
    toast(`${icon('bag')}<span>Comprado: ${esc(offer.name)}${quantity > 1 ? ` ×${quantity}` : ''}${extra}</span>`, 'success');
  });

  bindSteppers(el, (id, value) => {
    qty[id] = Math.max(1, value);
    draw();
  });

  ctx.onCleanup(onState(draw));
  ctx.interval(() => {
    el.querySelectorAll('[data-countdown]').forEach((n) => { n.textContent = countdown(n.dataset.countdown); });
  }, 1000);

  draw();
}
