// Armazém: personagens, itens e moedas, com filtros.

import { api } from '../store.js';
import { CURRENCY_ICON, charCard, esc, fmt, icon, openModal, viewHead } from '../ui.js';

const USE_HINT = {
  ticket: ['Usar no Templo da Sorte', '#/gacha', 'gacha'],
  xp: ['Usar no Treinamento', '#/treino', 'training'],
  material: ['Usar no Treinamento', '#/treino', 'training'],
  equipment: ['Equipar no Treinamento', '#/treino', 'shoe'],
  frame: ['Equipar na sua Casa', '#/perfil', 'home'],
  title: ['Equipar na sua Casa', '#/perfil', 'home'],
};

const CURRENCY_INFO = {
  coins: 'Moeda do dia a dia: treino, melhorias da fazenda e Loja. Vem da Fazenda e das missões.',
  carats: 'Moeda premium: 150 por pull no Templo da Sorte. Vem de missões, conquistas, subir de nível e da Fazenda.',
  fragments: 'Vêm de cópias além do Despertar 5. Troque na Loja por tickets e personagens específicas.',
};

const itemIcon = (it) => `<span class="item-icon r${it.rarity}">${icon(it.icon)}</span>`;

export async function render(el, params, ctx) {
  const data = await api.get('/api/inventory');
  if (!ctx.alive) return;

  let tab = ['personagens', 'itens', 'moedas'].includes(params[0]) ? params[0] : 'personagens';
  const chars = { rarity: 0, distance: '', sort: 'power' };
  const items = { category: '', sort: 'rarity' };

  const equippedBy = Object.fromEntries(data.equipped.map((e) => [e.item.id, e.character]));

  function charactersHtml() {
    const sorters = {
      power: (a, b) => b.power - a.power,
      level: (a, b) => b.level - a.level || b.power - a.power,
      rarity: (a, b) => b.character.rarity - a.character.rarity || b.power - a.power,
      name: (a, b) => a.character.name.localeCompare(b.character.name),
    };
    const list = data.characters
      .filter((c) => (!chars.rarity || c.character.rarity === chars.rarity)
        && (!chars.distance || c.character.distance === chars.distance))
      .sort(sorters[chars.sort]);
    return `
      <div class="row-between">
        <div class="row" style="gap:6px">
          ${[0, 5, 4, 3].map((r) => `<button class="chip ${chars.rarity === r ? 'active' : ''}" data-crarity="${r}">${r ? `${r}★` : 'Todas'}</button>`).join('')}
        </div>
        <div class="row" style="gap:6px">
          <select class="select" data-cdistance aria-label="Distância">
            <option value="">Todas as distâncias</option>
            ${[['curta', 'Curta'], ['milha', 'Milha'], ['media', 'Média'], ['longa', 'Longa']].map(([v, l]) =>
              `<option value="${v}" ${chars.distance === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <select class="select" data-csort aria-label="Ordenar">
            ${[['power', 'Poder'], ['level', 'Nível'], ['rarity', 'Raridade'], ['name', 'Nome']].map(([v, l]) =>
              `<option value="${v}" ${chars.sort === v ? 'selected' : ''}>Ordenar: ${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <p class="small muted" style="margin:10px 0">${list.length} de ${data.characters.length} personagens · coleção ${data.characters.length}/${data.catalog_total}</p>
      ${list.length ? `<div class="card-grid">${list.map((c) => charCard(c.character, {
        href: `#/treino/${c.id}`,
        meta: `Nv. ${c.level} · ${icon('bolt')}${fmt(c.power)}`,
        corner: c.awakening ? `<span class="chip chip-purple">${icon('awakening')}${c.awakening}</span>` : '',
        flag: c.equipment ? `<span class="chip" title="${esc(c.equipment.name)}">${icon(c.equipment.icon)}</span>` : '',
      })).join('')}</div>` : `<div class="empty">${icon('search')}Nenhuma personagem com esses filtros.</div>`}`;
  }

  function itemsHtml() {
    const sorters = {
      rarity: (a, b) => b.rarity - a.rarity || a.sort - b.sort,
      qty: (a, b) => b.qty - a.qty,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    const list = data.items.filter((i) => !items.category || i.category === items.category).sort(sorters[items.sort]);
    return `
      <div class="row-between">
        <div class="row" style="gap:6px">
          <button class="chip ${!items.category ? 'active' : ''}" data-icat="">Todos</button>
          ${Object.entries(data.categories).map(([k, l]) => `<button class="chip ${items.category === k ? 'active' : ''}" data-icat="${k}">${esc(l)}</button>`).join('')}
        </div>
        <select class="select" data-isort aria-label="Ordenar">
          ${[['rarity', 'Raridade'], ['qty', 'Quantidade'], ['name', 'Nome']].map(([v, l]) =>
            `<option value="${v}" ${items.sort === v ? 'selected' : ''}>Ordenar: ${l}</option>`).join('')}
        </select>
      </div>
      <div style="margin-top:14px">${list.length ? `<div class="item-grid">${list.map((i) => `
        <button class="item-tile r${i.rarity}" data-item="${esc(i.id)}">
          <span class="item-qty">×${fmt(i.qty)}</span>
          ${itemIcon(i)}
          <span class="item-name">${esc(i.name)}</span>
        </button>`).join('')}</div>` : `<div class="empty">${icon('crate')}Nada nesta categoria.</div>`}</div>
      ${data.equipped.length ? `<p class="small muted" style="margin-top:14px">Em uso: ${data.equipped.map((e) =>
        `${esc(e.item.name)} (${esc(e.character)})`).join(' · ')}</p>` : ''}`;
  }

  function currenciesHtml() {
    const ticket = data.items.find((i) => i.id === 'ticket');
    const card = (key, label, qty, text) => `
      <div class="panel" style="box-shadow:none;background:var(--panel-2)">
        <div class="row"><span class="item-icon m-${key}" style="background:#fff;box-shadow:inset 0 0 0 2px var(--line)">${icon(CURRENCY_ICON[key])}</span>
          <div><div class="tiny muted bold" style="text-transform:uppercase;letter-spacing:.04em">${esc(label)}</div>
          <div style="font-family:var(--font);font-weight:900;font-size:1.6rem">${fmt(qty)}</div></div></div>
        <p class="small muted" style="margin-top:8px">${text}</p>
      </div>`;
    return `<div class="grid-2">
      ${data.currencies.map((c) => card(c.key, c.name, c.qty, CURRENCY_INFO[c.key])).join('')}
      ${card('tickets', 'Tickets de Recrutamento', ticket?.qty || 0, '1 ticket = 1 pull. São usados antes dos carats, e o que faltar num 10x sai em carats.')}
    </div>`;
  }

  el.innerHTML = `
    ${viewHead({ icon: 'storage', tone: 'ink', title: 'Armazém', sub: 'Tudo o que você tem: personagens, itens, materiais, equipamentos e moedas.' })}
    <div class="tabs" data-tabs>
      <button class="tab" data-tab="personagens">${icon('horse')}Personagens <span class="chip">${data.characters.length}</span></button>
      <button class="tab" data-tab="itens">${icon('crate')}Itens <span class="chip">${data.items.length}</span></button>
      <button class="tab" data-tab="moedas">${icon('coin')}Moedas</button>
    </div>
    <section class="panel" data-body></section>`;

  const body = el.querySelector('[data-body]');
  function draw() {
    el.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    body.innerHTML = { personagens: charactersHtml, itens: itemsHtml, moedas: currenciesHtml }[tab]();
  }

  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; window.history.replaceState(null, '', `#/armazem/${tab}`); draw(); return; }
    const r = e.target.closest('[data-crarity]');
    if (r) { chars.rarity = Number(r.dataset.crarity); draw(); return; }
    const cat = e.target.closest('[data-icat]');
    if (cat) { items.category = cat.dataset.icat; draw(); return; }
    const it = e.target.closest('[data-item]');
    if (!it) return;
    const item = data.items.find((i) => i.id === it.dataset.item);
    const [hint, href, hintIcon] = USE_HINT[item.category];
    openModal({
      title: item.name,
      icon: item.icon,
      tone: item.rarity >= 5 ? 'gold' : item.rarity === 4 ? 'purple' : 'sky',
      body: `<p>${esc(item.description)}</p>
        <p class="small muted" style="margin-top:10px">Quantidade: <strong>${fmt(item.qty)}</strong> · ${esc(data.categories[item.category])}</p>
        ${equippedBy[item.id] ? `<p class="small" style="margin-top:6px">Também equipado em: <strong>${esc(equippedBy[item.id])}</strong></p>` : ''}`,
      actions: [{ label: `${icon(hintIcon)}${hint}`, cls: 'btn-primary', onClick: (c) => { c(); location.hash = href; } }],
    });
  });

  el.addEventListener('change', (e) => {
    if (e.target.matches('[data-cdistance]')) chars.distance = e.target.value;
    else if (e.target.matches('[data-csort]')) chars.sort = e.target.value;
    else if (e.target.matches('[data-isort]')) items.sort = e.target.value;
    else return;
    draw();
  });

  draw();
}
