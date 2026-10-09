// Templo da Sorte (Gacha): banners, pity, pulls com revelação animada, taxas e histórico.

import { api, onState, state } from '../store.js';
import {
  act, bar, countdown, esc, fmt, fullArt, icon, money, openModal, panelTitle, portrait, stars, timeAgo, viewHead,
} from '../ui.js';
import { OUTCOME, openReveal } from '../gacha/reveal.js';

export async function render(el, params, ctx) {
  const data = await api.get('/api/gacha');
  if (!ctx.alive) return;

  let active = data.banners.some((b) => b.key === params[0]) ? params[0] : 'limited';
  const hist = { page: 1, rarity: '', banner: '' };
  const TAB_ICON = { limited: 'star-burst', duo: 'sparkle', standard: 'horse' };
  const TAB_SHORT = { limited: 'Holofote', duo: 'Dupla Estelar', standard: 'Lendas' }; // celular

  const banner = () => data.banners.find((b) => b.key === active);

  /** Igual ao servidor: tickets primeiro, o que faltar sai em carats. */
  function cost(count) {
    const me = state.me;
    const tickets = Math.min(me.tickets, count);
    const carats = (count - tickets) * banner().cost.carats;
    const parts = [];
    if (tickets) parts.push(money('tickets', tickets));
    if (carats || !tickets) parts.push(money('carats', carats));
    return { html: parts.join('<span class="plus">+</span>'), ok: me.carats >= carats };
  }

  function pullButton(count, cls = '', title = '') {
    const c = cost(count);
    return `<button class="btn btn-lg btn-stack ${cls}" data-pull="${count}" ${title ? `title="${esc(title)}"` : ''} ${c.ok ? '' : 'disabled'}>
      Pull ${count}x <span class="cost">${c.html}</span></button>`;
  }

  function heroHtml() {
    const b = banner();
    const p = b.pity;
    const star = b.featured5[0];
    const duo = b.type === 'limited' && b.featured5.length > 1;
    const max = b.cost.max || 10;
    // Com 2 a 9 tickets aparece um botão para gastar todos de uma vez.
    const batch = state.me.tickets > 1 && state.me.tickets < max ? state.me.tickets : 0;
    const softAt = (p.soft_pity / p.hard_pity) * 100;
    const fours = `<div class="banner-four">${b.featured4.map((c) => `<div class="mini">${portrait(c, 46)}${esc(c.name)}</div>`).join('')}</div>`;
    let showcase;
    if (duo) {
      showcase = `
      <div class="banner-showcase">
        <div class="bs-duo">${b.featured5.map((c) => fullArt(c)).join('')}</div>
        <div class="bs-name">${stars(5)}${b.featured5.map((c) => `<span>${esc(c.name)}</span>`).join('')}${fours}</div>
      </div>`;
    } else if (b.type === 'limited') {
      showcase = `
      <div class="banner-showcase">
        ${fullArt(star)}
        <div class="bs-name">${stars(5)}<span>${esc(star.name)}</span>${fours}</div>
      </div>`;
    } else {
      showcase = `
      <div class="banner-showcase">
        <div class="banner-std">${b.featured5.map((c) => `<div class="mini">${portrait(c, 72)}${esc(c.name)}</div>`).join('')}</div>
      </div>`;
    }
    const second = b.featured5[1];
    const tint = duo ? `--c:${esc(star.color)};--c2:${esc(second.color)}`
      : b.type === 'limited' ? `--c:${esc(star.color)};--c2:${esc(star.color2 || star.color)}` : '';
    return `
      <div class="banner-hero ${b.type} ${duo ? 'duo' : ''}" style="${tint}">
        ${showcase}
        <div class="banner-info">
          <div class="row">
            <span class="chip">${icon(b.type === 'limited' ? 'hourglass' : 'flag')}${b.type === 'limited' ? 'Limitado' : 'Permanente'}</span>
            ${b.ends_at ? `<span class="chip">Termina em <span data-countdown="${esc(b.ends_at)}">${countdown(b.ends_at)}</span></span>` : ''}
            ${duo ? `<span class="chip">${icon('sparkle')}Duas 5★ em destaque</span>` : ''}
          </div>
          <h2>${esc(b.name)}</h2>
          <p class="sub">${esc(b.subtitle)}</p>

          <div class="pity-box">
            <div class="row-between"><strong>Pity 5★</strong><span class="bold">${p.pity5} / ${p.hard_pity}</span></div>
            ${bar((p.pity5 / p.hard_pity) * 100, 'thick', `<span class="mark" style="--at:${softAt}%" title="Pity suave a partir do ${p.soft_pity}"></span>`)}
            <div class="row-between small">
              <span>4★ garantida em ${p.pity4_max - p.pity4} pull(s)</span>
              ${b.type === 'limited' ? (p.guaranteed
                ? `<span class="chip">${icon('target')}${duo ? 'Próxima 5★ é uma das destacadas!' : 'Próxima 5★ é a destacada!'}</span>`
                : `<span class="chip">${icon('dice')}50/50 ativo</span>`) : ''}
            </div>
            <div class="pity4-dots">${Array.from({ length: p.pity4_max }, (_, i) => `<i class="${i < p.pity4 ? 'on' : ''}"></i>`).join('')}</div>
          </div>

          <div class="pull-row ${batch ? 'has-batch' : ''}">
            ${pullButton(1)}
            ${batch ? pullButton(batch, 'btn-pink', `Usa os seus ${batch} tickets de uma vez`) : ''}
            ${pullButton(max, 'btn-gold')}
          </div>
          <div class="row-between small">
            <span class="row" style="gap:8px">Você tem ${money('tickets', state.me.tickets)} ${money('carats', state.me.carats)}</span>
            <button class="btn btn-sm" data-rates>${icon('list')}Taxas e pool</button>
          </div>
        </div>
      </div>`;
  }

  el.innerHTML = `
    ${viewHead({ icon: 'gacha', tone: 'pink', title: 'Templo da Sorte', sub: 'Recrute novas corredoras. Todo sorteio acontece no servidor.' })}
    <div class="tabs" data-tabs>
      ${data.banners.map((b) => `<button class="tab ${b.key === active ? 'active' : ''}" data-tab="${b.key}">
        ${icon(TAB_ICON[b.key] || 'star-burst')}<span class="t-full">${esc(b.name)}</span><span class="t-short">${esc(TAB_SHORT[b.key] || b.name)}</span></button>`).join('')}
    </div>
    <div data-hero>${heroHtml()}</div>
    <div class="grid-2 wide-left">
      <section class="panel">
        ${panelTitle('history', 'Seu histórico', `
          <select class="select" data-hist-banner aria-label="Banner">
            <option value="">Todos os banners</option><option value="limited">Limitados</option><option value="standard">Padrão</option>
          </select>
          <select class="select" data-hist-rarity aria-label="Raridade">
            <option value="">Todas</option><option value="5">5★</option><option value="4">4★</option><option value="3">3★</option>
          </select>`)}
        <div data-history><div class="loading">Carregando…</div></div>
      </section>
      <section class="panel">
        ${panelTitle('star-burst', 'Últimas 5★ do servidor')}
        <div data-recent></div>
      </section>
    </div>`;

  const heroEl = el.querySelector('[data-hero]');
  const drawHero = () => { heroEl.innerHTML = heroHtml(); };

  function drawRecent() {
    el.querySelector('[data-recent]').innerHTML = data.recent_five_stars.length
      ? `<div class="stack" style="gap:8px">${data.recent_five_stars.map((p) => `
          <div class="event-card">${portrait(p.character, 42)}
            <div class="ev-body"><h4>${esc(p.character.name)}</h4>
            <p class="small muted"><a href="#/perfil/${encodeURIComponent(p.nickname)}">${esc(p.nickname)}</a> · ${p.pity} pity${p.featured ? ' · destaque' : ''} · ${timeAgo(p.created_at)}</p></div>
          </div>`).join('')}</div>`
      : `<div class="empty">${icon('star-burst')}Nenhuma 5★ ainda. A sorte está esperando você!</div>`;
  }

  async function loadHistory() {
    const q = new URLSearchParams({ page: hist.page });
    if (hist.rarity) q.set('rarity', hist.rarity);
    if (hist.banner) q.set('banner_type', hist.banner);
    const h = await api.get(`/api/gacha/history?${q}`);
    if (!ctx.alive) return;
    const box = el.querySelector('[data-history]');
    if (!h.items.length) {
      box.innerHTML = `<div class="empty">${icon('history')}Nenhum pull por aqui ainda.</div>`;
      return;
    }
    box.innerHTML = `
      <table class="history-table">
        <thead><tr><th>Personagem</th><th class="hide-sm">Banner</th><th>Pity</th><th>Resultado</th><th class="hide-sm">Quando</th></tr></thead>
        <tbody>${h.items.map((p) => `
          <tr class="r${p.rarity}">
            <td><span class="hist-char">${portrait(p.character, 30)}<span>${stars(p.rarity)}<br><strong>${esc(p.character.name)}</strong></span>${p.featured ? `<span class="chip chip-gold">${icon('target')}</span>` : ''}</span></td>
            <td class="hide-sm">${esc(p.banner_label)}</td>
            <td>${p.pity}</td>
            <td>${OUTCOME[p.outcome](p)}</td>
            <td class="hide-sm muted">${timeAgo(p.created_at)}</td>
          </tr>`).join('')}</tbody>
      </table>
      <div class="pager">
        <span class="small muted">${fmt(h.total)} pulls · página ${h.page}/${h.pages}</span>
        <button class="btn btn-sm" data-page="-1" aria-label="Página anterior" ${h.page <= 1 ? 'disabled' : ''}>${icon('prev')}</button>
        <button class="btn btn-sm" data-page="1" aria-label="Próxima página" ${h.page >= h.pages ? 'disabled' : ''}>${icon('next')}</button>
      </div>`;
  }

  function showRates() {
    const b = banner();
    const r = b.rates;
    const duo = b.type === 'limited' && b.featured5.length > 1;
    const featuredRules = !r.featured_chance ? '' : duo ? `
            <li>Ao tirar 5★ há <strong>50%</strong> de ser uma das duas destacadas, sorteada entre elas (${b.featured5.map((c) => esc(c.name)).join(' ou ')}).
              Se vier outra, a próxima 5★ é garantidamente uma das duas, também sorteada.</li>` : `
            <li>Ao tirar 5★ há <strong>50%</strong> de ser a destacada. Se vier outra, a próxima 5★ é garantidamente a destacada.</li>`;
    const pool = (list) => list.map((c) => `<span class="chip">${portrait(c, 18)}${esc(c.name)}</span>`).join(' ');
    openModal({
      title: 'Taxas e pool',
      icon: 'list',
      tone: 'pink',
      wide: true,
      body: `
        <div class="stack">
          <div class="stat-tiles">
            <div class="stat-tile"><div class="st-value tag r5">${(r.five * 100).toFixed(1)}%</div><div class="st-label">Chance base 5★</div></div>
            <div class="stat-tile"><div class="st-value tag r4">${(r.four * 100).toFixed(1)}%</div><div class="st-label">Chance base 4★</div></div>
            <div class="stat-tile"><div class="st-value">${r.hard_pity}</div><div class="st-label">5★ garantida no pull</div></div>
            <div class="stat-tile"><div class="st-value">${r.pity4}</div><div class="st-label">4★+ garantida a cada</div></div>
          </div>
          <ul class="small" style="margin:0;padding-left:18px;line-height:1.7">
            <li>A partir do pull <strong>${r.soft_pity}</strong> a chance de 5★ sobe 6 pontos percentuais por pull (pity suave).</li>
            <li>O Holofote da semana e a Dupla Estelar dividem o mesmo pity e a mesma garantia, que continuam quando o destaque troca.
              O banner permanente tem o próprio pity.</li>
            <li>Tickets são gastos primeiro e o que faltar sai em carats (${fmt(b.cost.carats)} por pull):
              6 tickets + ${fmt(4 * b.cost.carats)} carats fecham um 10x. Com 2 a 9 tickets dá para usar todos de uma vez.</li>
            ${featuredRules}
            ${r.featured_chance ? '<li>4★ têm 50% de chance de ser uma das três destacadas.</li>' : ''}
            <li>Cópias repetidas aumentam o <strong>Despertar</strong> (até 5). Depois disso viram Fragmentos Estelares para a Loja.</li>
          </ul>
          <div><strong>5★</strong><div class="row" style="gap:6px;margin-top:6px">${pool(b.pool.five)}</div></div>
          <div><strong>4★</strong><div class="row" style="gap:6px;margin-top:6px">${pool(b.pool.four)}</div></div>
          <div><strong>3★</strong><div class="row" style="gap:6px;margin-top:6px">${pool(b.pool.three)}</div></div>
        </div>`,
    });
  }

  let pulling = false;
  async function pull(count, button) {
    if (pulling || button.disabled) return;
    pulling = true;
    const b = banner();
    // O bilhete entra na hora do clique, enquanto o servidor sorteia.
    const show = openReveal({ count, banner: b, serial: (state.me.total_pulls || 0) + 1 });
    const res = await act(button, () => api.post('/api/gacha/pull', { banner: b.key, count }));
    if (!res) {
      show.cancel();
      pulling = false;
      return;
    }
    // Os banners limitados dividem o pity: atualiza todos do mesmo tipo.
    for (const other of data.banners) if (other.type === b.type) other.pity = res.pity;
    drawHero();
    await show.play(res.results, res.paid);
    pulling = false;
    if (!ctx.alive) return;
    if (res.results.some((r) => r.rarity === 5)) {
      const g = await api.get('/api/gacha').catch(() => null);
      if (g && ctx.alive) { data.recent_five_stars = g.recent_five_stars; drawRecent(); }
    }
    hist.page = 1;
    loadHistory();
  }

  el.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      active = tab.dataset.tab;
      window.history.replaceState(null, '', `#/gacha/${active}`);
      el.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('active', t === tab));
      drawHero();
      return;
    }
    const pullBtn = e.target.closest('[data-pull]');
    if (pullBtn) { pull(Number(pullBtn.dataset.pull), pullBtn); return; }
    if (e.target.closest('[data-rates]')) { showRates(); return; }
    const page = e.target.closest('[data-page]');
    if (page) {
      hist.page += Number(page.dataset.page);
      loadHistory();
    }
  });
  el.querySelector('[data-hist-banner]').addEventListener('change', (e) => {
    hist.banner = e.target.value; hist.page = 1; loadHistory();
  });
  el.querySelector('[data-hist-rarity]').addEventListener('change', (e) => {
    hist.rarity = e.target.value; hist.page = 1; loadHistory();
  });

  ctx.onCleanup(onState(drawHero));
  ctx.interval(() => {
    el.querySelectorAll('[data-countdown]').forEach((n) => { n.textContent = countdown(n.dataset.countdown); });
  }, 1000);

  drawRecent();
  loadHistory();
}
