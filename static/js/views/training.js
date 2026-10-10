// Centro de Treinamento: nível (manuais), atributos, habilidades, ascensão, equipamento e ficha oficial.

import { api, state } from '../store.js';
import {
  STAT_ICON, act, bar, bindSteppers, esc, fmt, fullArt, icon, money, pips, portrait, stars, stepper, toast, viewHead,
} from '../ui.js';

const MANUALS = ['manual_basico', 'manual_avancado', 'manual_elite'];
const USE_ORDER = ['manual_elite', 'manual_avancado', 'manual_basico'];
const TABS = [
  ['nivel', 'level', 'Nível'], ['atributos', 'carrot', 'Atributos'], ['habilidades', 'skill', 'Habilidades'],
  ['ascensao', 'ascension', 'Ascensão'], ['equipamento', 'shoe', 'Equipamento'], ['ficha', 'info', 'Ficha'],
];

const xpToNext = (level) => Math.floor(200 + 60 * level ** 1.5);

/** Mesma regra do servidor: manuais do maior para o menor, parando no limite de nível. */
function simulate(c, qty, items, coins) {
  let { level, xp } = c;
  let spent = 0;
  let outOfCoins = false;
  const used = {};
  for (const id of USE_ORDER) {
    const d = items[id].data;
    for (let i = 0; i < (qty[id] || 0); i += 1) {
      if (level >= c.level_cap) break;
      if (coins - spent < d.coins) { outOfCoins = true; break; }
      spent += d.coins;
      used[id] = (used[id] || 0) + 1;
      xp += d.xp;
      while (level < c.level_cap && xp >= xpToNext(level)) { xp -= xpToNext(level); level += 1; }
      if (level >= c.level_cap) xp = 0;
    }
  }
  return { level, xp, spent, used, outOfCoins };
}

const itemIcon = (it) => `<span class="item-icon r${it.rarity}">${icon(it.icon)}</span>`;

export async function render(el, params, ctx) {
  const rosterRes = await api.get('/api/characters');
  if (!ctx.alive) return;
  let roster = rosterRes.characters;

  if (!roster.length) {
    el.innerHTML = `${viewHead({ icon: 'training', tone: 'sky', title: 'Centro de Treinamento' })}
      <div class="panel empty">${icon('horse')}Você ainda não tem personagens. <a href="#/gacha">Vá ao Templo da Sorte!</a></div>`;
    return;
  }

  let selectedId = Number(params[0]);
  if (!roster.some((c) => c.id === selectedId)) {
    selectedId = roster[0].id;
    window.history.replaceState(null, '', `#/treino/${selectedId}`);
  }
  let detail = null;
  let tab = 'nivel';
  let qty = { manual_basico: 0, manual_avancado: 0, manual_elite: 0 };
  const filter = { q: '', rarity: 0 };

  el.innerHTML = `
    ${viewHead({ icon: 'training', tone: 'sky', title: 'Centro de Treinamento', sub: 'Suba nível, treine atributos, evolua habilidades e rompa limites com a ascensão.' })}
    <div class="train-layout">
      <aside class="panel roster">
        <label class="search-input">${icon('search')}<input class="input" type="search" placeholder="Buscar personagem…" data-search aria-label="Buscar personagem"></label>
        <div class="row" style="gap:6px">
          ${[0, ...(roster.some((c) => c.character.rarity === 6) ? [6] : []), 5, 4, 3].map((r) =>
            `<button class="chip ${r === 0 ? 'active' : ''}" data-rarity="${r}">${r ? `${r}★` : 'Todas'}</button>`).join('')}
        </div>
        <div class="roster-list" data-roster></div>
      </aside>
      <section class="stack" data-detail><div class="loading">Carregando…</div></section>
    </div>`;

  const rosterEl = el.querySelector('[data-roster]');
  const detailEl = el.querySelector('[data-detail]');

  function drawRoster() {
    const list = roster.filter((c) => (!filter.rarity || c.character.rarity === filter.rarity)
      && c.character.name.toLowerCase().includes(filter.q));
    rosterEl.innerHTML = list.length ? list.map((c) => `
      <a class="roster-item ${c.id === selectedId ? 'active' : ''}" href="#/treino/${c.id}" data-select="${c.id}">
        ${portrait(c.character, 40)}
        <div><div class="ri-name">${esc(c.character.name)}</div>
          <div class="ri-sub">${stars(c.character.rarity)} Nv. ${c.level}</div></div>
        <span class="ri-power">${icon('bolt')}${fmt(c.power)}</span>
      </a>`).join('') : '<div class="empty small">Nenhuma personagem encontrada.</div>';
  }

  const have = (r) => {
    if (r.kind === 'coins') return state.me.coins;
    if (r.kind === 'carats') return state.me.carats;
    if (r.kind === 'fragments') return state.me.fragments;
    return detail.materials.items[r.id]?.qty ?? 0;
  };

  const costLines = (list) => `<div class="cost-list">${list.map((r) => {
    const h = have(r);
    return `<div class="cost-line ${h >= r.qty ? 'ok' : 'missing'}">${icon(r.icon)}${esc(r.name)}
      <span class="have">${fmt(h)} / ${fmt(r.qty)}</span></div>`;
  }).join('')}</div>`;

  const canPay = (list) => list.every((r) => have(r) >= r.qty);

  function levelTab(c, items) {
    if (c.at_cap) {
      return c.next_ascension
        ? `<div class="empty">${icon('lock')}Nível ${c.level} é o limite deste estágio.<br><br>
            <button class="btn btn-gold" data-goto-tab="ascensao">${icon('ascension')}Ir para Ascensão</button></div>`
        : `<div class="empty">${icon('trophy')}Nível máximo absoluto! Esta corredora chegou ao topo.</div>`;
    }
    const sim = simulate(c, qty, items, state.me.coins);
    const anySelected = MANUALS.some((m) => qty[m] > 0);
    const usedText = Object.entries(sim.used).map(([id, n]) => `${esc(items[id].name)} ×${n}`).join(' · ');
    return `
      ${MANUALS.map((id) => {
        const it = items[id];
        return `<div class="manual-row">
          ${itemIcon(it)}
          <div><strong>${esc(it.name)}</strong>
            <div class="small muted">+${fmt(it.data.xp)} XP · ${money('coins', it.data.coins)} cada · você tem <strong>${fmt(it.qty)}</strong></div></div>
          ${stepper(id, Math.min(qty[id], it.qty), it.qty)}
        </div>`;
      }).join('')}
      <div class="preview-box" style="margin-top:12px">
        <div class="row-between"><strong>Prévia</strong>
          <span class="bold">Nv. ${c.level} → ${sim.level}${sim.level >= c.level_cap ? ' (limite)' : ''}</span></div>
        ${bar(sim.level >= c.level_cap ? 100 : (sim.xp / xpToNext(sim.level)) * 100)}
        <div class="small">${anySelected
          ? `Serão usados: ${usedText || '—'} · Custo: ${money('coins', sim.spent)}${sim.outOfCoins ? ' · <span style="color:var(--danger)">moedas insuficientes para o resto</span>' : ''}`
          : 'Escolha a quantidade de manuais. Só o necessário é consumido: o que passar do limite volta para o inventário.'}</div>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:12px">
        <button class="btn btn-ghost" data-clear>Limpar</button>
        <button class="btn" data-fill>Usar tudo até o limite</button>
        <button class="btn btn-primary" data-level ${Object.keys(sim.used).length ? '' : 'disabled'}>${icon('level')}Treinar</button>
      </div>`;
  }

  function attrTab(c, mats) {
    const max = Math.max(...Object.values(c.stats).map((s) => s.total)) * 1.08;
    const carrots = mats.items.cenoura.qty;
    return `
      <p class="small muted">Cada sessão custa ${mats.attr_cost.map((r) => `${icon(r.icon)} ${fmt(r.qty)}`).join(' + ')}
        e dá de +3 a +7 pontos (10% de chance de <strong>treino excelente</strong>, em dobro).
        Limite de treino por atributo: <strong>${c.attr_cap}</strong> (aumenta com o nível).</p>
      <p class="small row" style="margin:8px 0 6px;gap:8px">Você tem <span class="money">${icon('carrot')}${fmt(carrots)}</span> ${money('coins', state.me.coins)}</p>
      ${Object.entries(c.stats).map(([key, s]) => {
        const full = s.bonus >= c.attr_cap;
        return `<div class="stat-row">
          <span class="sr-label">${icon(STAT_ICON[key])}${esc(s.label)}</span>
          <div>${bar((s.total / max) * 100, 'sky')}
            <div class="sr-break">base ${fmt(s.base)} · treino ${s.bonus}/${c.attr_cap}${s.equip ? ` · equipamento +${s.equip}` : ''}</div></div>
          <span class="sr-val">${fmt(s.total)}</span>
          <span class="sr-btns row" style="gap:4px">
            <button class="btn btn-sm" data-attr="${key}" data-times="1" ${full || !carrots ? 'disabled' : ''}>Treinar</button>
            <button class="btn btn-sm" data-attr="${key}" data-times="5" ${full || !carrots ? 'disabled' : ''}>×5</button>
          </span>
        </div>`;
      }).join('')}`;
  }

  function skillsTab(c) {
    return `<div class="stack">${c.skills.map((s) => `
      <div class="skill-card ${s.kind}">
        <div class="row-between"><strong class="row" style="gap:6px">${icon(s.kind === 'unique' ? 'sparkle' : 'skill')}${esc(s.name)}</strong>
          <span class="chip ${s.kind === 'unique' ? 'chip-gold' : ''}">${s.kind === 'unique' ? 'Única' : 'Genérica'}</span></div>
        <p class="small muted">${esc(s.description)}</p>
        <div class="row-between">${pips(s.level, s.max_level)}
          <span class="small bold">+${(s.power_bonus * s.level * 100).toFixed(1).replace('.', ',')}% de poder</span></div>
        ${s.upgrade_cost ? `
          ${costLines(s.upgrade_cost)}
          <button class="btn btn-sky" data-skill="${esc(s.id)}" ${canPay(s.upgrade_cost) ? '' : 'disabled'}>
            ${icon('level')}Evoluir para Nv. ${s.level + 1}</button>`
        : `<span class="chip chip-green">${icon('check')}Nível máximo</span>`}
      </div>`).join('')}</div>`;
  }

  function ascensionTab(c) {
    const next = c.next_ascension;
    if (!next) return `<div class="empty">${icon('ascension')}Ascensão máxima alcançada! Limite de nível 100.</div>`;
    const ready = next.ready;
    return `
      <div class="stack">
        <div class="row-between">
          <div><strong>Estágio ${next.stage} de ${c.max_ascension}</strong>
            <div class="small muted">Limite de nível: ${c.level_cap} → <strong>${next.new_cap}</strong> · +8% em todos os atributos</div></div>
          ${pips(c.ascension, c.max_ascension)}
        </div>
        <div class="cost-line ${ready ? 'ok' : 'missing'}">${icon(ready ? 'check' : 'lock')}Chegar ao nível ${c.level_cap}
          <span class="have">Nv. ${c.level}</span></div>
        ${costLines(next.cost)}
        <button class="btn btn-gold btn-lg" data-ascend ${ready && canPay(next.cost) ? '' : 'disabled'}>${icon('ascension')}Ascender</button>
      </div>`;
  }

  function equipmentTab(c, mats) {
    const eq = c.equipment;
    return `
      <div class="stack">
        <div class="row-between" style="padding:12px;border-radius:14px;background:var(--panel-2)">
          ${eq ? `<div class="row">${itemIcon(eq)}
              <div><strong>${esc(eq.name)}</strong><div class="small muted">${esc(eq.description)}</div></div></div>
              <button class="btn btn-sm" data-equip="">Remover</button>`
            : '<span class="muted">Nenhum equipamento. Equipamentos dão bônus fixos de atributo.</span>'}
        </div>
        ${mats.equipment.length ? `<div class="item-grid">${mats.equipment.map((it) => `
          <div class="item-tile r${it.rarity}" style="cursor:default">
            <span class="item-qty">×${it.qty}</span>
            ${itemIcon(it)}
            <span class="item-name">${esc(it.name)}</span>
            <span class="tiny muted">${esc(it.description)}</span>
            <button class="btn btn-sm btn-primary" data-equip="${esc(it.id)}">Equipar</button>
          </div>`).join('')}</div>`
          : `<div class="empty small">${icon('shoe')}Você não tem equipamentos livres. Eles ficam na <a href="#/loja">Loja</a> (aba Moedas).</div>`}
      </div>`;
  }

  function bioTab(bio) {
    if (!bio) return `<div class="empty">${icon('info')}Ficha oficial indisponível. Rode <code>python -m tools.sync_umapyoi</code>.</div>`;
    const birthday = bio.birthday?.day
      ? new Date(2000, bio.birthday.month - 1, bio.birthday.day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
      : '—';
    const sizes = bio.sizes?.b ? `B${bio.sizes.b} · W${bio.sizes.w} · H${bio.sizes.h}` : '—';
    const item = (label, value) => (value ? `<div class="bio-item"><dt>${label}</dt><dd>${esc(value)}</dd></div>` : '');
    return `
      <div class="stack">
        ${bio.slogan ? `<div class="bio-quote">${icon('talk')}<span>${esc(bio.slogan)}</span></div>` : ''}
        ${bio.profile ? `<p class="small" style="font-style:italic">"${esc(bio.profile)}"</p>` : ''}
        <dl class="bio">
          ${item('Nome original', bio.name_jp)}
          ${item('Aniversário', birthday)}
          ${item('Altura', bio.height ? `${bio.height} cm` : '')}
          ${item('Medidas', sizes)}
          ${item('Calçado', bio.shoe_size)}
          ${item('Peso', bio.weight)}
          ${item('Série', bio.grade)}
          ${item('Dormitório', bio.residence)}
          ${item('Pontos fortes', bio.strengths)}
          ${item('Pontos fracos', bio.weaknesses)}
        </dl>
        <dl class="bio">
          ${item('Sobre as orelhas', bio.ears_fact)}
          ${item('Sobre a cauda', bio.tail_fact)}
          ${item('Sobre a família', bio.family_fact)}
        </dl>
        <p class="tiny muted">Textos oficiais em inglês, via umapyoi.net${bio.link ? ` · <a href="${esc(bio.link)}" target="_blank" rel="noopener">página oficial</a>` : ''}.</p>
      </div>`;
  }

  function drawDetail() {
    const c = detail.character;
    const ch = c.character;
    const mats = detail.materials;
    const body = {
      nivel: () => levelTab(c, mats.items),
      atributos: () => attrTab(c, mats),
      habilidades: () => skillsTab(c),
      ascensao: () => ascensionTab(c),
      equipamento: () => equipmentTab(c, mats),
      ficha: () => bioTab(detail.bio),
    }[tab]();

    detailEl.innerHTML = `
      <div class="char-head" style="--c:${esc(ch.color)};--c2:${esc(ch.color2 || ch.color)}">
        <div class="ch-art">${fullArt(ch)}</div>
        <div class="ch-info">
          <div class="row" style="gap:6px">${stars(ch.rarity)}
            <span class="chip">${icon('distance')}${esc(ch.distance_label)}</span><span class="chip">${icon('horse')}${esc(ch.style_label)}</span></div>
          <h2>${esc(ch.name)}</h2>
          ${detail.bio?.name_jp ? `<span class="jp">${esc(detail.bio.name_jp)}</span>` : ''}
          <div class="row small"><span><strong>Nv. ${c.level}</strong>/${c.level_cap}</span>
            <span title="Ascensão">${pips(c.ascension, c.max_ascension)}</span>
            <span title="Despertar">${pips(c.awakening, c.max_awakening, 'awaken')}</span></div>
          <div style="max-width:380px">${bar(c.at_cap ? 100 : (c.xp / c.xp_to_next) * 100)}
            <div class="tiny muted" style="margin-top:3px">${c.at_cap ? 'Limite do estágio' : `${fmt(c.xp)} / ${fmt(c.xp_to_next)} XP`}</div></div>
        </div>
        <div class="power-box"><div class="pl">Poder</div><div class="pv">${icon('bolt')}${fmt(c.power)}</div>
          ${c.equipment ? `<span class="chip">${icon(c.equipment.icon)}${esc(c.equipment.name)}</span>` : ''}</div>
      </div>
      <div class="tabs">${TABS.map(([id, ic, label]) => `<button class="tab ${id === tab ? 'active' : ''}" data-tab="${id}">${icon(ic)}${label}</button>`).join('')}</div>
      <div class="panel">${body}</div>`;
  }

  async function loadDetail(id) {
    selectedId = id;
    qty = { manual_basico: 0, manual_avancado: 0, manual_elite: 0 };
    drawRoster();
    const res = await api.get(`/api/characters/${id}`);
    if (!ctx.alive || selectedId !== id) return;
    detail = res;
    drawDetail();
  }

  function applyResult(res) {
    detail = { ...detail, character: res.character, materials: res.materials };
    roster = roster.map((c) => (c.id === res.character.id ? { ...c, ...res.character } : c));
    roster.sort((a, b) => b.power - a.power);
    drawRoster();
    drawDetail();
  }

  async function post(button, path, body, message) {
    const res = await act(button, () => api.post(`/api/characters/${selectedId}/${path}`, body));
    if (!res || !ctx.alive) return;
    applyResult(res);
    toast(message(res.result), 'success');
  }

  el.addEventListener('click', (e) => {
    const sel = e.target.closest('[data-select]');
    if (sel) {
      e.preventDefault();
      window.history.pushState(null, '', `#/treino/${sel.dataset.select}`);
      loadDetail(Number(sel.dataset.select));
      return;
    }
    const rar = e.target.closest('[data-rarity]');
    if (rar) {
      filter.rarity = Number(rar.dataset.rarity);
      el.querySelectorAll('[data-rarity]').forEach((b) => b.classList.toggle('active', b === rar));
      drawRoster();
      return;
    }
    const tabBtn = e.target.closest('[data-tab]') || e.target.closest('[data-goto-tab]');
    if (tabBtn) {
      tab = tabBtn.dataset.tab || tabBtn.dataset.gotoTab;
      drawDetail();
      return;
    }
    if (!detail) return;
    const items = detail.materials.items;

    if (e.target.closest('[data-clear]')) { qty = { manual_basico: 0, manual_avancado: 0, manual_elite: 0 }; drawDetail(); return; }
    if (e.target.closest('[data-fill]')) {
      MANUALS.forEach((m) => { qty[m] = items[m].qty; });
      drawDetail();
      return;
    }
    const lvl = e.target.closest('[data-level]');
    if (lvl) {
      const manuals = Object.fromEntries(MANUALS.filter((m) => qty[m] > 0).map((m) => [m, qty[m]]));
      qty = { manual_basico: 0, manual_avancado: 0, manual_elite: 0 };
      post(lvl, 'level', { manuals }, (r) => (r.levels_gained
        ? `${icon('level')}<span>+${r.levels_gained} nível(is)! ${fmt(r.coins_spent)} moedas gastas.</span>`
        : `${icon('level')}<span>XP adicionada!</span>`));
      return;
    }
    const attr = e.target.closest('[data-attr]');
    if (attr) {
      post(attr, 'attribute', { stat: attr.dataset.attr, times: Number(attr.dataset.times) },
        (r) => `${icon(STAT_ICON[r.stat])}<span>+${r.gain} ${esc(r.label)} em ${r.sessions} treino(s)${r.great ? ` · ${r.great} excelente(s)!` : ''}</span>`);
      return;
    }
    const skill = e.target.closest('[data-skill]');
    if (skill) {
      post(skill, 'skill', { skill_id: skill.dataset.skill }, (r) => `${icon('skill')}<span>${esc(r.skill)} chegou ao Nv. ${r.level}!</span>`);
      return;
    }
    const asc = e.target.closest('[data-ascend]');
    if (asc) {
      post(asc, 'ascend', {}, (r) => `${icon('ascension')}<span>Ascensão ${r.ascension}! Novo limite: Nv. ${r.level_cap}</span>`);
      return;
    }
    const eq = e.target.closest('[data-equip]');
    if (eq) {
      const itemId = eq.dataset.equip || null;
      post(eq, 'equip', { item_id: itemId }, () => `${icon('shoe')}<span>${itemId ? 'Equipamento colocado!' : 'Equipamento removido.'}</span>`);
    }
  });

  el.addEventListener('input', (e) => {
    if (e.target.matches('[data-search]')) {
      filter.q = e.target.value.trim().toLowerCase();
      drawRoster();
    }
  });

  bindSteppers(detailEl, (name, value) => {
    qty[name] = value;
    drawDetail();
  });

  await loadDetail(selectedId);
}
