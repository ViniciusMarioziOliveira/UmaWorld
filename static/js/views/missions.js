// Escritório de Missões: diárias, semanais e conquistas.

import { api } from '../store.js';
import { act, badgeIcon, bar, countdown, esc, fmt, icon, rewardChips, toast, viewHead } from '../ui.js';

const TABS = [
  ['daily', 'sunrise', 'Diárias'],
  ['weekly', 'calendar', 'Semanais'],
  ['achievement', 'achievement', 'Conquistas'],
];
const TONE = { daily: 'green', weekly: 'sky', achievement: 'gold' };

export async function render(el, params, ctx) {
  let data = await api.get('/api/missions');
  if (!ctx.alive) return;
  let tab = TABS.some(([id]) => id === params[0]) ? params[0] : 'daily';

  const claimable = (cat) => data[cat].filter((x) => x.claimable).length;

  function listHtml() {
    const list = [...data[tab]].sort((a, b) => (b.claimable - a.claimable) || (a.claimed - b.claimed));
    const reset = tab === 'achievement' ? '' : data.resets[tab];
    return `
      <div class="row-between" style="margin-bottom:12px">
        <span class="small muted row" style="gap:6px">${icon('hourglass')}${reset
          ? `Renova em <strong data-countdown="${esc(reset)}">${countdown(reset)}</strong>`
          : 'Conquistas são permanentes e aparecem no Chat Global quando resgatadas.'}</span>
        <button class="btn btn-primary btn-sm" data-claim-all ${claimable(tab) ? '' : 'disabled'}>${icon('gift')}Resgatar tudo (${claimable(tab)})</button>
      </div>
      <div class="stack" style="gap:10px">${list.map((x) => `
        <div class="mission ${x.claimable ? 'claimable' : ''} ${x.claimed ? 'claimed' : ''}">
          ${badgeIcon(x.icon, x.claimed ? 'ink' : TONE[tab], 'ib-lg')}
          <div>
            <h4>${esc(x.title)}</h4>
            <div class="m-desc">${esc(x.description)}</div>
            <div class="m-prog">${bar((x.progress / x.target) * 100, x.claimable || x.claimed ? '' : 'sky')}
              <span>${fmt(x.progress)} / ${fmt(x.target)}</span></div>
            ${rewardChips(x.rewards)}
          </div>
          <div class="m-action">${x.claimed
            ? `<span class="chip chip-green">${icon('check')}Resgatada</span>`
            : `<button class="btn ${x.claimable ? 'btn-primary' : ''}" data-claim="${esc(x.id)}" ${x.claimable ? '' : 'disabled'}>
                ${x.claimable ? `${icon('gift')}Resgatar` : 'Em andamento'}</button>`}</div>
        </div>`).join('')}</div>`;
  }

  el.innerHTML = `
    ${viewHead({ icon: 'missions', tone: 'green', title: 'Escritório de Missões', sub: 'Complete objetivos para ganhar carats, tickets, materiais e XP de conta.' })}
    <div class="tabs" data-tabs></div>
    <section class="panel" data-body></section>`;

  function draw() {
    el.querySelector('[data-tabs]').innerHTML = TABS.map(([id, ic, label]) => `
      <button class="tab ${id === tab ? 'active' : ''}" data-tab="${id}">${icon(ic)}${label}
        ${claimable(id) ? `<span class="badge">${claimable(id)}</span>` : ''}</button>`).join('');
    el.querySelector('[data-body]').innerHTML = listHtml();
  }

  function celebrate(res) {
    data = res.missions;
    draw();
    toast(`${icon('gift')}<span>Recompensas recebidas!</span>${rewardChips(res.rewards)}`, 'success', 4200);
  }

  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; window.history.replaceState(null, '', `#/missoes/${tab}`); draw(); return; }
    const one = e.target.closest('[data-claim]');
    if (one) {
      const res = await act(one, () => api.post(`/api/missions/${one.dataset.claim}/claim`));
      if (res && ctx.alive) celebrate(res);
      return;
    }
    const all = e.target.closest('[data-claim-all]');
    if (all) {
      const res = await act(all, () => api.post('/api/missions/claim-all', { category: tab }));
      if (res && ctx.alive) celebrate(res);
    }
  });

  ctx.interval(() => {
    el.querySelectorAll('[data-countdown]').forEach((n) => { n.textContent = countdown(n.dataset.countdown); });
  }, 1000);

  draw();
}
