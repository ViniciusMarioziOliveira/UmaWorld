// Fazenda (Farm AFK): produção ao vivo (calculada no cliente a partir das taxas do servidor),
// coleta, ajudantes e melhorias.

import { api, state } from '../store.js';
import {
  act, bar, charCard, duration, esc, fmt, icon, money, openModal, panelTitle, portrait, rewardChips, toast, viewHead,
} from '../ui.js';

export async function render(el, _params, ctx) {
  let farm = await api.get('/api/afk');
  if (!ctx.alive) return;
  let offset = 0; // diferença entre o relógio do servidor e o do navegador

  const sync = (f) => {
    farm = f;
    offset = Date.parse(f.server_time) - Date.now();
  };
  sync(farm);

  function liveState() {
    const elapsed = Math.max(0, (Date.now() + offset - Date.parse(farm.last_collected_at)) / 3600000);
    const effective = Math.min(elapsed, farm.storage_hours);
    return {
      elapsed,
      effective,
      full: elapsed >= farm.storage_hours,
      ready: elapsed * 60 >= farm.min_collect_minutes,
      pending: farm.resources.map((r) => ({ ...r, now: r.rate * effective + r.carry })),
    };
  }

  function sceneHtml() {
    return `
      <div class="farm-scene" data-farm>
        <div class="stack" style="gap:10px">
          <div class="fs-crops" aria-hidden="true">${['wheat', 'carrot', 'wheat', 'carrot', 'wheat', 'carrot'].map((c) => icon(c)).join('')}</div>
          <h2>Fazenda Nv. ${farm.level}</h2>
          <div class="small bold" data-status></div>
          ${bar(0, 'thick')}
          <div class="tiny bold" data-acc></div>
        </div>
        <button class="btn btn-primary btn-lg" data-collect></button>
      </div>`;
  }

  function resourcesHtml() {
    return farm.resources.map((r) => `
      <div class="res-card">
        <span class="item-icon r${r.rarity}">${icon(r.icon)}</span>
        <div><div class="rv" data-res="${esc(r.key)}">0</div>
          <div class="rr">${esc(r.name)}</div>
          <div class="rr">+${fmt(r.rate < 10 ? Math.round(r.rate * 100) / 100 : Math.round(r.rate))}/h</div></div>
      </div>`).join('');
  }

  /** Atualiza só os números (sem recriar o botão, para não perder cliques). */
  function tick() {
    const s = liveState();
    const scene = el.querySelector('[data-farm]');
    scene.classList.toggle('full', s.full);
    scene.querySelector('[data-status]').textContent = s.full
      ? 'Armazém cheio! A produção parou — colete para recomeçar.'
      : `Produzindo… armazém cheio em ${duration(farm.storage_hours - s.elapsed)}`;
    scene.querySelector('.bar > i').style.setProperty('--p', `${(s.effective / farm.storage_hours) * 100}%`);
    scene.querySelector('[data-acc]').textContent =
      `${duration(s.effective)} de ${farm.storage_hours}h acumuladas · eficiência ${Math.round(farm.efficiency * 100)}%`;
    const btn = scene.querySelector('[data-collect]');
    const wait = Math.ceil(farm.min_collect_minutes - s.elapsed * 60);
    const key = s.ready ? 'ready' : `wait-${wait}`;
    if (btn.dataset.key !== key) {
      btn.dataset.key = key;
      btn.innerHTML = s.ready ? `${icon('basket')}Coletar tudo` : `${icon('hourglass')}Disponível em ${wait} min`;
    }
    if (!btn.dataset.busy) btn.disabled = !s.ready;
    s.pending.forEach((r) => {
      const node = el.querySelector(`[data-res="${r.key}"]`);
      if (node) node.textContent = fmt(Math.floor(r.now));
    });
  }

  function helpersHtml() {
    const bySlot = Object.fromEntries(farm.helpers.map((h) => [h.slot, h]));
    return Array.from({ length: farm.helper_slots }, (_, i) => {
      const h = bySlot[i + 1];
      return h ? `
        <button class="helper-slot filled" data-slot="${i + 1}">
          ${portrait(h.character, 58)}
          <strong class="small">${esc(h.character.name)}</strong>
          <span class="chip chip-green">+${Math.round(h.bonus * 1000) / 10}%</span>
        </button>` : `
        <button class="helper-slot" data-slot="${i + 1}">
          ${icon('plus')}
          <strong class="small">Vaga ${i + 1}</strong>
          <span class="tiny muted">Escale uma ajudante</span>
        </button>`;
    }).join('');
  }

  function upgradesHtml() {
    const f = farm.upgrades.farm;
    const st = farm.upgrades.storage;
    const coinsRate = farm.resources.find((r) => r.key === 'coins');
    const nextCoins = f.next_rates ? f.next_rates.coins * farm.efficiency : 0;
    return `
      <div class="upgrade-card">
        <div class="row-between"><strong class="row" style="gap:6px">${icon('farm')}Fazenda</strong><span class="chip">Nv. ${farm.level}/${farm.max_level}</span></div>
        ${f.cost ? `
          <div class="small muted row" style="gap:4px">${money('coins', Math.round(coinsRate.rate))}/h → <strong>${money('coins', Math.round(nextCoins))}/h</strong> e mais materiais</div>
          <button class="btn btn-primary" data-upgrade="farm" ${state.me.coins >= f.cost ? '' : 'disabled'}>${icon('hammer')}Melhorar · ${money('coins', f.cost)}</button>`
          : `<span class="chip chip-green">${icon('check')}Nível máximo</span>`}
      </div>
      <div class="upgrade-card">
        <div class="row-between"><strong class="row" style="gap:6px">${icon('crate')}Armazém</strong><span class="chip">Nv. ${farm.storage_level}/${farm.storage_max_level}</span></div>
        ${st.cost ? `
          <div class="small muted">Acumula ${farm.storage_hours}h → <strong>${st.next_hours}h</strong> de produção</div>
          <button class="btn btn-primary" data-upgrade="storage" ${state.me.coins >= st.cost ? '' : 'disabled'}>${icon('hammer')}Melhorar · ${money('coins', st.cost)}</button>`
          : `<span class="chip chip-green">${icon('check')}Nível máximo</span>`}
      </div>`;
  }

  el.innerHTML = `
    ${viewHead({ icon: 'farm', tone: 'gold', title: 'Fazenda', sub: 'A fazenda produz enquanto você está fora. Volte para coletar antes que o armazém encha!' })}
    <div data-scene>${sceneHtml()}</div>
    <section class="panel">
      ${panelTitle('basket', 'Pronto para coletar', 'valores atualizados ao vivo')}
      <div class="res-grid" data-resources>${resourcesHtml()}</div>
    </section>
    <div class="grid-2">
      <section class="panel">
        ${panelTitle('horse', 'Ajudantes', '5★ +15% · 4★ +10% · 3★ +5% (+ nível/10 %)')}
        <div class="helper-slots" data-helpers>${helpersHtml()}</div>
      </section>
      <section class="panel">
        ${panelTitle('hammer', 'Melhorias')}
        <div class="stack" data-upgrades>${upgradesHtml()}</div>
      </section>
    </div>`;

  const drawAll = () => {
    el.querySelector('[data-scene]').innerHTML = sceneHtml();
    el.querySelector('[data-resources]').innerHTML = resourcesHtml();
    el.querySelector('[data-helpers]').innerHTML = helpersHtml();
    el.querySelector('[data-upgrades]').innerHTML = upgradesHtml();
    tick();
  };

  function showCollected(list, title = 'Colheita concluída!') {
    if (!list.length) return;
    toast(`${icon('basket')}<span>${esc(title)}</span>`, 'success');
    openModal({ title, icon: 'basket', tone: 'gold', body: rewardChips(list),
      actions: [{ label: 'Oba!', cls: 'btn-primary', onClick: (close) => close() }] });
  }

  async function chooseHelper(slot) {
    const res = await api.get('/api/characters');
    const current = farm.helpers.map((h) => h.user_character_id);
    const slotOwner = farm.helpers.find((h) => h.slot === slot);
    const modal = openModal({
      title: `Ajudante da vaga ${slot}`,
      icon: 'horse',
      tone: 'gold',
      wide: true,
      body: `
        ${slotOwner ? '<button class="btn btn-sm" data-pick="" style="margin-bottom:12px">Deixar vaga vazia</button>' : ''}
        <div class="select-grid">${res.characters.map((c) => `
          <button class="selectable ${current.includes(c.id) ? 'selected' : ''}" data-pick="${c.id}">
            ${charCard(c.character, { meta: `Nv. ${c.level}${current.includes(c.id) ? ' · na fazenda' : ''}` })}
          </button>`).join('')}</div>`,
    });
    modal.el.addEventListener('click', async (e) => {
      const pick = e.target.closest('[data-pick]');
      if (!pick) return;
      const ucId = pick.dataset.pick ? Number(pick.dataset.pick) : null;
      const slots = [1, 2, 3].map((s) => farm.helpers.find((h) => h.slot === s)?.user_character_id ?? null)
        .map((id) => (id === ucId ? null : id)); // se já estava em outra vaga, sai de lá
      slots[slot - 1] = ucId;
      const out = await act(pick, () => api.post('/api/afk/helpers', { slots }));
      if (!out) return;
      modal.close();
      sync(out.farm);
      drawAll();
      showCollected(out.collected, 'Produção anterior coletada');
    });
  }

  el.addEventListener('click', async (e) => {
    const collect = e.target.closest('[data-collect]');
    if (collect) {
      collect.dataset.busy = '1';
      const res = await act(collect, () => api.post('/api/afk/collect'));
      delete collect.dataset.busy;
      if (!res || !ctx.alive) return;
      sync(res.farm);
      drawAll();
      showCollected(res.collected);
      return;
    }
    const up = e.target.closest('[data-upgrade]');
    if (up) {
      const res = await act(up, () => api.post('/api/afk/upgrade', { kind: up.dataset.upgrade }));
      if (!res || !ctx.alive) return;
      sync(res.farm);
      drawAll();
      toast(`${icon('hammer')}<span>${up.dataset.upgrade === 'farm' ? `Fazenda agora no Nv. ${farm.level}!` : `Armazém agora guarda ${farm.storage_hours}h!`}</span>`, 'success');
      if (res.collected.length) showCollected(res.collected, 'Produção anterior coletada');
      return;
    }
    const slot = e.target.closest('[data-slot]');
    if (slot) chooseHelper(Number(slot.dataset.slot)).catch((err) => toast(esc(err.message), 'error'));
  });

  tick();
  ctx.interval(tick, 1000);
}
