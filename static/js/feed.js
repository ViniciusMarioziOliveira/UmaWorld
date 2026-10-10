// Painel do Chat Global (usado no jogo e na tela de login).

import { live, subscribe } from './realtime.js';
import { avatar, esc, formatFeed, icon, timeAgo } from './ui.js';

const KIND_TONE = {
  six_star: 'teal', five_star: 'gold', exchange: 'pink', milestone: 'sky', rank_up: 'green', ascension: 'purple',
  awakening: 'purple', achievement: 'pink', shop_character: 'pink', new_player: 'ink', farm: 'gold',
};

function itemHtml(ev, fresh, linkProfiles) {
  const nick = ev.nickname
    ? (linkProfiles ? `<a class="fi-nick" href="#/perfil/${encodeURIComponent(ev.nickname)}">${esc(ev.nickname)}</a> `
                    : `<span class="fi-nick">${esc(ev.nickname)}</span> `)
    : '';
  return `<div class="feed-item k-${esc(ev.kind)} ${fresh ? 'fresh' : ''}" data-id="${ev.id}">
    <span class="ib tone-${KIND_TONE[ev.kind] || 'ink'} ib-sm">${icon(ev.icon)}</span>
    <div class="fi-body"><p>${nick}${formatFeed(ev.message)}</p>
    <time datetime="${esc(ev.created_at)}">${timeAgo(ev.created_at)}</time></div>
  </div>`;
}

export function mountFeed(container, { linkProfiles = true, onNew } = {}) {
  container.innerHTML = `
    <div class="feed-head">
      <div class="panel-title"><span class="live-dot" data-dot></span><span>Chat Global</span>
        <span class="sub" data-count></span></div>
      <div class="online-list" data-online></div>
    </div>
    <div class="feed-list" data-list aria-live="polite"></div>`;
  const list = container.querySelector('[data-list]');
  const dot = container.querySelector('[data-dot]');
  const count = container.querySelector('[data-count]');
  const online = container.querySelector('[data-online]');

  const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 80;

  function renderAll() {
    list.innerHTML = live.events.length
      ? live.events.map((ev) => itemHtml(ev, false, linkProfiles)).join('')
      : `<div class="feed-empty">${icon('newspaper')}<span>Nada por aqui ainda. Faça um pull e apareça no feed!</span></div>`;
    list.scrollTop = list.scrollHeight;
  }

  function renderPresence() {
    const n = live.online.length;
    count.textContent = `${n} online${live.viewers > n ? ` · ${live.viewers - n} assistindo` : ''}`;
    online.innerHTML = live.online.slice(0, 40).map((p) => {
      const chip = `${avatar({ nickname: p.nickname, avatar_id: p.avatar }, 20)}<span>${esc(p.nickname)}</span>`;
      return linkProfiles
        ? `<a class="chip chip-online" href="#/perfil/${encodeURIComponent(p.nickname)}" title="Nível ${p.level}">${chip}</a>`
        : `<span class="chip chip-online" title="Nível ${p.level}">${chip}</span>`;
    }).join('');
  }

  function renderStatus() {
    dot.classList.toggle('on', live.connected);
    dot.title = live.connected ? 'Conectado em tempo real' : 'Reconectando…';
  }

  const unsubscribe = subscribe((type, ev) => {
    if (type === 'reset') renderAll();
    else if (type === 'presence') renderPresence();
    else if (type === 'status') renderStatus();
    else if (type === 'feed') {
      const stick = nearBottom();
      list.querySelector('.feed-empty')?.remove();
      list.insertAdjacentHTML('beforeend', itemHtml(ev, true, linkProfiles));
      while (list.children.length > 100) list.firstElementChild.remove();
      if (stick) list.scrollTop = list.scrollHeight;
      onNew?.(ev);
    }
  });

  const clock = setInterval(() => {
    list.querySelectorAll('time').forEach((t) => { t.textContent = timeAgo(t.getAttribute('datetime')); });
  }, 30000);

  renderAll();
  renderPresence();
  renderStatus();
  return () => { unsubscribe(); clearInterval(clock); };
}
