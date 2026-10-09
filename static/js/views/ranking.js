// Hall da Fama (Ranking): leaderboards por categoria + a posição do jogador.

import { api } from '../store.js';
import { avatar, esc, fmt, icon, portrait, rankBadge, stars, viewHead } from '../ui.js';

const ORDER = ['level', 'power', 'pulls', 'collection', 'five_stars'];

export async function render(el, params, ctx) {
  const category = ORDER.includes(params[0]) ? params[0] : 'level';
  const data = await api.get(`/api/ranking/${category}`);
  if (!ctx.alive) return;
  const cat = data.categories[category];

  const valueLabel = (row) => {
    if (category === 'level') return `Nv. ${row.value}`;
    if (category === 'power') return `${icon('bolt')} ${fmt(row.value)}`;
    return `${fmt(row.value)} ${esc(cat.unit)}`;
  };
  const position = (n) => (n <= 3 ? `<span class="medal p${n}">${n}</span>` : n);

  el.innerHTML = `
    ${viewHead({ icon: 'ranking', tone: 'gold', title: 'Hall da Fama', sub: 'Os melhores treinadores do servidor, atualizados a cada visita.' })}
    <div class="tabs">${ORDER.map((id) => {
      const c = data.categories[id];
      return `<a class="tab ${id === category ? 'active' : ''}" href="#/ranking/${id}">${icon(c.icon)}${esc(c.label)}</a>`;
    }).join('')}</div>

    <div class="my-rank">
      <span class="mr-pos">${data.mine.position ? `#${data.mine.position}` : '—'}</span>
      <div><div class="bold">Sua posição em ${esc(cat.label)}</div>
        <div class="small" style="opacity:.8">${data.mine.position ? valueLabel(data.mine) : 'Você ainda não entrou neste ranking.'}</div></div>
    </div>

    <section class="panel">
      ${data.rows.length ? `<table class="rank-table"><tbody>${data.rows.map((r) => `
        <tr class="${r.is_me ? 'me' : ''} ${r.position === 1 ? 'top1' : ''}">
          <td>${position(r.position)}</td>
          <td>
            <div class="rank-player">
              ${category === 'power' ? portrait(r.character, 38) : avatar(r, 38)}
              <div>
                ${category === 'power'
                  ? `<strong>${esc(r.character.name)}</strong> ${stars(r.character.rarity)}
                     <div class="tiny muted">de <a href="#/perfil/${encodeURIComponent(r.nickname)}">${esc(r.nickname)}</a> · Nv. ${r.character_level}</div>`
                  : `<a href="#/perfil/${encodeURIComponent(r.nickname)}"><strong>${esc(r.nickname)}</strong></a>
                     <div class="tiny">${rankBadge(r.rank)} <span class="muted">· Nv. ${r.level}</span></div>`}
              </div>
            </div>
          </td>
          <td>${valueLabel(r)}</td>
        </tr>`).join('')}</tbody></table>` : `<div class="empty">${icon('ranking')}Ninguém neste ranking ainda.</div>`}
    </section>`;
}
