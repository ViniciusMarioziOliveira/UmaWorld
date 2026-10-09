// Componentes e utilitários de interface (strings HTML + helpers de DOM).

export const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const pad = (n) => String(n).padStart(2, '0');

export function initials(name) {
  const words = String(name).split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : String(name).slice(0, 2)).toUpperCase();
}

// ------------------------------------------------------------- ícones (sprite em /img/icons.svg)

export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" aria-hidden="true" focusable="false"><use href="#i-${esc(name)}"></use></svg>`;

/** Ícone dentro de um selo colorido (tons: green, pink, sky, gold, purple, ink). */
export const badgeIcon = (name, tone = 'green', cls = '') => `<span class="ib tone-${tone} ${cls}">${icon(name)}</span>`;

export const kbd = (key) => `<kbd>${esc(key)}</kbd>`;

export const CURRENCY_ICON = { coins: 'coin', carats: 'carat', fragments: 'fragment', tickets: 'ticket' };
export const CURRENCY_NAME = { coins: 'moedas', carats: 'carats', fragments: 'fragmentos', tickets: 'tickets' };
export const STAT_ICON = { speed: 'speed', stamina: 'stamina', power: 'power', guts: 'guts', wit: 'wit' };

export const money = (key, value) => `<span class="money m-${key}">${icon(CURRENCY_ICON[key])}${fmt(value)}</span>`;

export const stars = (r, cls = '') =>
  `<span class="stars r${r} ${cls}" role="img" aria-label="${r} estrelas">${icon('star').repeat(r)}</span>`;

export const rankBadge = (rank) => `<span class="rank tier-${rank.tier}">${icon(rank.icon)}${esc(rank.name)}</span>`;

// ------------------------------------------------------------- artes das personagens (umapyoi, locais)

export const umaImg = (id, kind) => `/img/umas/${id}/${kind}.webp`;

/** Retrato redondo (ícone oficial). Sem imagem, mostra as iniciais na cor da personagem. */
export function portrait(char, size = 48, cls = '') {
  return `<span class="portrait ${cls}" style="--c:${esc(char.color)};--s:${size}px"><b>${esc(initials(char.name))}</b>${
    char.img ? `<img src="${umaImg(char.id, 'icon')}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''
  }</span>`;
}

/** Arte de corpo inteiro (roupa de corrida). */
export function fullArt(char, cls = '') {
  if (!char.img) return portrait(char, 160, cls);
  return `<img class="fullart ${cls}" src="${umaImg(char.id, 'full')}" alt="${esc(char.name)}" decoding="async">`;
}

/** Avatar de jogador: a corredora escolhida para o mundo, com a moldura equipada. */
export function avatar(user, size = 38) {
  const charId = user?.avatar?.character?.id || user?.avatar_id;
  const frame = user?.frame?.data?.css ? `frame-${esc(user.frame.data.css)}` : '';
  const img = charId ? `<img src="${umaImg(charId, 'icon')}" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<span class="avatar ${frame}" style="--s:${size}px"><b>${esc(initials(user?.nickname || '?'))}</b>${img}</span>`;
}

export function charCard(c, { href = '', meta = '', flag = '', corner = '', tag = 'div', attrs = '', locked = false } = {}) {
  const el = href ? 'a' : tag;
  return `<${el} class="ccard r${c.rarity} ${locked ? 'locked' : ''}" ${href ? `href="${href}"` : ''} ${attrs}>
    <div class="ccard-art" style="--c:${esc(c.color)};--c2:${esc(c.color2 || c.color)}">
      ${flag ? `<span class="ccard-flag">${flag}</span>` : ''}
      ${corner ? `<span class="ccard-corner">${corner}</span>` : ''}
      <span class="ccard-ini">${esc(initials(c.name))}</span>
      ${c.img ? `<img src="${umaImg(c.id, 'card')}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}
    </div>
    <div class="ccard-body">
      ${stars(c.rarity)}
      <div class="ccard-name" title="${locked ? '' : esc(c.name)}">${locked ? '???' : esc(c.name)}</div>
      ${meta ? `<div class="ccard-meta">${meta}</div>` : ''}
    </div>
  </${el}>`;
}

export function rewardChips(list) {
  return `<div class="rewards">${list.map((r) => `
    <span class="reward r${r.rarity}" title="${esc(r.name)}">${
      r.kind === 'character' ? `${portrait(r, 20)}${esc(r.name)}` : `${icon(r.icon)}${fmt(r.qty)}`
    }</span>`).join('')}</div>`;
}

export const bar = (pct, cls = '', extra = '') =>
  `<div class="bar ${cls}"><i style="--p:${Math.max(0, Math.min(100, pct))}%"></i>${extra}</div>`;

export function pips(on, total, cls = '') {
  return `<span class="pips ${cls}" role="img" aria-label="${on} de ${total}">${
    Array.from({ length: total }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</span>`;
}

export function viewHead({ icon: name, tone = 'green', title, sub = '', actions = '' }) {
  return `<div class="view-head">
    ${badgeIcon(name, tone, 'ib-lg')}
    <div class="vh-text">
      <a class="crumb" href="#/mundo">${icon('back')}Voltar ao mundo</a>
      <h1>${esc(title)}</h1>
      ${sub ? `<p>${sub}</p>` : ''}
    </div>
    ${actions ? `<div class="vh-actions">${actions}</div>` : ''}
  </div>`;
}

export function panelTitle(name, title, sub = '', tone = '') {
  return `<div class="panel-title">${icon(name, tone ? `tone-text-${tone}` : '')}<span>${esc(title)}</span>${
    sub ? `<span class="sub">${sub}</span>` : ''}</div>`;
}

// ------------------------------------------------------------- tempo

export function countdown(iso) {
  let s = Math.max(0, Math.floor((new Date(iso) - Date.now()) / 1000));
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function duration(hours) {
  const totalMin = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${pad(m)}min` : `${m} min`;
}

export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 45) return 'agora';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export const dateBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

/** "[5★ Nome]" vira um destaque na cor da raridade (aceita o formato antigo com ⭐). */
export function formatFeed(message) {
  return esc(message).replace(/\[(\d)[★⭐] ([^\]]+)\]/g,
    (_, r, n) => `<span class="tag r${r}">${r}${icon('star')} ${n}</span>`);
}

// ------------------------------------------------------------- toasts

export function toast(message, type = 'info', ms = 3200) {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = message;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, ms);
}

export const toastError = (e) => toast(`${icon('warning')}<span>${esc(e?.message || e)}</span>`, 'error', 4200);

// ------------------------------------------------------------- modal

export function openModal({ title, icon: name = '', tone = 'green', body = '', wide = false, actions = [], onClose } = {}) {
  const root = document.getElementById('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" tabindex="-1" aria-label="${esc(title)}">
      <div class="modal-head">${name ? badgeIcon(name, tone) : ''}<h3>${esc(title)}</h3>
        <button class="icon-btn" data-close aria-label="Fechar">${icon('close')}</button></div>
      <div class="modal-body">${body}</div>
      ${actions.length ? `<div class="modal-actions">${actions.map((a, i) =>
        `<button class="btn ${a.cls || ''}" data-action-index="${i}">${a.label}</button>`).join('')}</div>` : ''}
    </div>`;
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close]')) close();
    const btn = e.target.closest('[data-action-index]');
    if (btn) actions[Number(btn.dataset.actionIndex)].onClick?.(close, btn);
  });
  document.addEventListener('keydown', onKey);
  root.appendChild(backdrop);
  backdrop.querySelector('.modal').focus();
  return { el: backdrop.querySelector('.modal'), close };
}

/** Executa uma ação de botão: desabilita enquanto roda e mostra erro como toast. */
export async function act(button, fn) {
  if (button?.disabled) return undefined;
  if (button) button.disabled = true;
  try {
    return await fn();
  } catch (e) {
    toastError(e);
    return undefined;
  } finally {
    if (button && button.isConnected) button.disabled = false;
  }
}

export function stepper(name, value, max, min = 0) {
  return `<span class="stepper" data-stepper="${esc(name)}">
    <button type="button" data-step="-1" aria-label="Menos" ${value <= min ? 'disabled' : ''}>${icon('minus')}</button>
    <input type="number" inputmode="numeric" min="${min}" max="${max}" value="${value}" aria-label="Quantidade">
    <button type="button" data-step="1" aria-label="Mais" ${value >= max ? 'disabled' : ''}>${icon('plus')}</button>
  </span>`;
}

/** Liga steppers de um container; `onChange(name, value)` recebe o valor já limitado. */
export function bindSteppers(container, onChange) {
  const clampValue = (input, raw) => Math.max(Number(input.min || 0), Math.min(Number(input.max), Math.floor(raw)));
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-step]');
    if (!btn) return;
    const wrap = btn.closest('[data-stepper]');
    const input = wrap.querySelector('input');
    onChange(wrap.dataset.stepper, clampValue(input, Number(input.value || 0) + Number(btn.dataset.step)));
  });
  container.addEventListener('change', (e) => {
    const wrap = e.target.closest('[data-stepper]');
    if (!wrap) return;
    const input = wrap.querySelector('input');
    onChange(wrap.dataset.stepper, clampValue(input, Number(input.value) || 0));
  });
}
