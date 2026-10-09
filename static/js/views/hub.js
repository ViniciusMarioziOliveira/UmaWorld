// Praça Central — quadro de avisos (aberto pela Tazuna ou pelo quadro no mundo).

import { api, state } from '../store.js';
import { live, subscribe } from '../realtime.js';
import { avatar, badgeIcon, countdown, esc, fmt, icon, panelTitle, portrait, stars, timeAgo, umaImg, viewHead } from '../ui.js';

const SHORTCUTS = [
  ['gacha', 'gacha', 'Templo da Sorte', 'pink'], ['treino', 'training', 'Treinamento', 'sky'],
  ['afk', 'farm', 'Fazenda', 'gold'], ['armazem', 'storage', 'Armazém', 'ink'],
  ['missoes', 'missions', 'Missões', 'green'], ['loja', 'shop', 'Loja', 'pink'],
  ['perfil', 'home', 'Sua Casa', 'purple'], ['ranking', 'ranking', 'Hall da Fama', 'gold'],
];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export async function render(el, _params, ctx) {
  const hub = await api.get('/api/hub');
  if (!ctx.alive) return;
  const b = hub.badges;

  const badgeFor = (id) => {
    if (id === 'missoes' && b.missions) return `<span class="badge">${b.missions}</span>`;
    if (id === 'afk' && b.afk_full) return '<span class="badge">!</span>';
    return '';
  };

  const onlineHtml = () => (live.online.length
    ? live.online.map((p) => `<a class="chip chip-online" href="#/perfil/${encodeURIComponent(p.nickname)}">
        ${avatar({ nickname: p.nickname, avatar_id: p.avatar }, 22)}<span>${esc(p.nickname)} · Nv. ${p.level}</span></a>`).join('')
    : '<span class="muted small">Ninguém online agora.</span>');

  el.innerHTML = `
    ${viewHead({ icon: 'plaza', tone: 'green', title: 'Praça Central', sub: 'Quadro de avisos da Academia: eventos, recados e quem está por aqui.' })}
    <div class="hero-banner">
      <h1>${greeting()}, ${esc(state.me.nickname)}!</h1>
      <p>"Boas-vindas à Academia Tracen! Os avisos mais recentes estão logo abaixo."</p>
      <p class="tiny" style="opacity:.85">— Tazuna Hayakawa, secretária da Academia</p>
      <img class="hb-npc" src="${umaImg('npc_tazuna', 'sprite')}" alt="" onerror="this.remove()">
    </div>

    <div class="shortcut-grid">
      ${SHORTCUTS.map(([id, ic, label, tone]) => `
        <a class="shortcut" href="#/${id}">${badgeIcon(ic, tone)}${label}${badgeFor(id)}</a>`).join('')}
    </div>

    <div class="grid-2">
      <div class="stack">
        <section class="panel">
          ${panelTitle('party', 'Eventos ativos')}
          <div class="stack" style="gap:8px">
            ${hub.events.map((ev) => `
              <a class="event-card" href="#/${ev.link}">
                ${ev.characters ? `<span class="ev-duo">${ev.characters.map((c) => portrait(c, 46)).join('')}</span>`
                  : ev.character ? portrait(ev.character, 46) : badgeIcon(ev.icon, 'sky')}
                <div class="ev-body">
                  <h4>${esc(ev.title)}</h4>
                  <p class="small muted">${esc(ev.description)}</p>
                </div>
                ${ev.ends_at
                  ? `<span class="chip">${icon('hourglass')}<span class="countdown" data-countdown="${esc(ev.ends_at)}">${countdown(ev.ends_at)}</span></span>`
                  : `<span class="chip chip-gold">${icon('sparkle')}Novo</span>`}
              </a>`).join('')}
          </div>
        </section>

        <section class="panel">
          ${panelTitle('megaphone', 'Avisos do servidor')}
          <div class="stack" style="gap:8px">
            ${hub.announcements.map((a) => `
              <article class="announce ${a.pinned ? 'pinned' : ''}">
                ${badgeIcon(a.icon, a.pinned ? 'gold' : 'ink', 'ib-sm')}
                <div><h4>${esc(a.title)}</h4><p>${esc(a.body)}</p></div>
              </article>`).join('')}
          </div>
        </section>
      </div>

      <div class="stack">
        <section class="panel">
          ${panelTitle('users', 'Jogadores online', `<span data-online-count>${live.online.length}</span>`)}
          <div class="row" data-online style="gap:6px">${onlineHtml()}</div>
        </section>

        <section class="panel">
          ${panelTitle('stats', 'Servidor')}
          <div class="stat-tiles">
            <div class="stat-tile"><div class="st-value">${icon('users')}${fmt(hub.stats.players)}</div><div class="st-label">Treinadores</div></div>
            <div class="stat-tile"><div class="st-value">${icon('dice')}${fmt(hub.stats.total_pulls)}</div><div class="st-label">Pulls no servidor</div></div>
            <div class="stat-tile"><div class="st-value">${icon('star-burst')}${fmt(hub.stats.five_stars_today)}</div><div class="st-label">5★ hoje</div></div>
          </div>
        </section>

        <section class="panel">
          ${panelTitle('star-burst', 'Últimas 5★ do servidor')}
          ${hub.recent_five_stars.length ? `<div class="stack" style="gap:8px">${hub.recent_five_stars.map((p) => `
            <div class="event-card">
              ${portrait(p.character, 42)}
              <div class="ev-body">
                <h4>${esc(p.character.name)} ${stars(5)}</h4>
                <p class="small muted"><a href="#/perfil/${encodeURIComponent(p.nickname)}">${esc(p.nickname)}</a> · ${p.pity} pity · ${timeAgo(p.created_at)}</p>
              </div>
            </div>`).join('')}</div>` : `<div class="empty">${icon('dice')}Ninguém tirou 5★ ainda. Que tal ser a primeira pessoa?</div>`}
        </section>
      </div>
    </div>`;

  ctx.interval(() => {
    el.querySelectorAll('[data-countdown]').forEach((n) => { n.textContent = countdown(n.dataset.countdown); });
  }, 1000);

  ctx.onCleanup(subscribe((type) => {
    if (type === 'presence') {
      el.querySelector('[data-online]').innerHTML = onlineHtml();
      el.querySelector('[data-online-count]').textContent = live.online.length;
    }
  }));
}
