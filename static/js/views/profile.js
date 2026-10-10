// Casa do Jogador: nível, rank, corredora do mundo, favoritas, estatísticas, conquistas e coleção.

import { api, state } from '../store.js';
import {
  act, avatar, badgeIcon, bar, charCard, dateBR, esc, fmt, icon, openModal, panelTitle, rankBadge, stars,
  timeAgo, toast, viewHead,
} from '../ui.js';

export async function render(el, params, ctx) {
  const nickname = params[0] || state.me.nickname;
  let p = await api.get(`/api/profile/${encodeURIComponent(nickname)}`);
  if (!ctx.alive) return;

  function draw() {
    const s = p.stats;
    const me = p.is_me ? state.me : null;
    const unlocked = p.achievements.filter((a) => a.unlocked).length;
    el.innerHTML = `
      ${viewHead({
        icon: 'home',
        tone: 'purple',
        title: p.is_me ? 'Sua Casa' : `Casa de ${p.nickname}`,
        sub: p.is_me ? 'Seu perfil público: é isso que os outros jogadores veem.' : `Treinador desde ${dateBR(p.created_at)} · visto ${timeAgo(p.last_seen_at)}`,
        actions: p.is_me ? `
          <button class="btn" data-customize>${icon('brush')}Personalizar</button>
          <button class="btn" data-favorites>${icon('heart')}Favoritas</button>` : '',
      })}

      <div class="profile-head">
        ${avatar(p, 96)}
        <div class="stack" style="gap:6px">
          <h1>${esc(p.nickname)}</h1>
          ${p.title ? `<span class="profile-title">${icon('title')}${esc(p.title.name)}</span>` : ''}
          ${p.frame ? `<span class="small muted row" style="gap:6px">${icon('frame')}${esc(p.frame.name)}</span>` : ''}
          ${p.avatar ? `<span class="small muted row" style="gap:6px">${icon('footprints')}Anda pelo mundo com <strong>${esc(p.avatar.character.name)}</strong></span>` : ''}
          ${me ? `<div style="max-width:360px">${bar(me.max_level ? 100 : (me.xp / me.xp_to_next) * 100, 'pink')}
            <div class="tiny muted" style="margin-top:3px">${me.max_level ? 'Nível máximo!' : `${fmt(me.xp)} / ${fmt(me.xp_to_next)} XP de conta`}</div></div>` : ''}
        </div>
        <div class="rank-badge">${rankBadge(p.rank)}<span class="small muted">Nível ${p.level}</span></div>
      </div>

      <section class="panel">
        ${panelTitle('heart', 'Favoritas')}
        <div class="fav-slots">${[0, 1, 2].map((i) => {
          const f = p.favorites[i];
          return f ? charCard(f.character, {
            href: p.is_me ? `#/treino/${f.id}` : '',
            meta: `Nv. ${f.level} · ${icon('bolt')}${fmt(f.power)}`,
            corner: f.awakening ? `<span class="chip chip-purple">${icon('awakening')}${f.awakening}</span>` : '',
          }) : `<div class="empty small">${p.is_me ? `<button class="btn btn-sm" data-favorites>${icon('plus')}Escolher</button>` : 'Vazio'}</div>`;
        }).join('')}</div>
      </section>

      <section class="panel">
        ${panelTitle('stats', 'Estatísticas')}
        <div class="stat-tiles cols-4">
          ${[
            ['dice', fmt(s.total_pulls), 'Pulls feitos'],
            ['star-burst', fmt(s.five_star_count), '5★ obtidas'],
            ['star', fmt(s.four_star_count), '4★ obtidas'],
            ['target', s.best_pity ? `${s.best_pity}` : '—', 'Melhor pity (5★)'],
            ['collection', `${s.collection}/${s.collection_total}`, 'Coleção'],
            ['bolt', fmt(s.max_power), 'Maior poder'],
            ['power', fmt(s.total_power), 'Poder total'],
            ['wheat', fmt(s.afk_collections), 'Coletas na fazenda'],
          ].map(([ic, v, l]) => `<div class="stat-tile"><div class="st-value">${icon(ic)}${v}</div><div class="st-label">${l}</div></div>`).join('')}
        </div>
      </section>

      <section class="panel">
        ${panelTitle('achievement', 'Conquistas', `${unlocked}/${p.achievements.length}`)}
        <div class="ach-grid">${p.achievements.map((a) => `
          <div class="ach ${a.unlocked ? '' : 'locked'}" title="${a.unlocked ? `Desbloqueada em ${dateBR(a.unlocked_at)}` : 'Bloqueada'}">
            ${badgeIcon(a.icon, a.unlocked ? 'gold' : 'ink')}
            <div><h4>${esc(a.title)}</h4><p>${esc(a.description)}</p></div>
          </div>`).join('')}</div>
      </section>

      <section class="panel">
        ${panelTitle('collection', 'Coleção', `${s.collection}/${s.collection_total} · ${Math.round((s.collection / s.collection_total) * 100)}%`)}
        ${bar((s.collection / s.collection_total) * 100, 'gold')}
        <div class="card-grid small" style="margin-top:14px">${p.collection.map((c) => charCard(c, {
          locked: !c.owned,
          meta: c.owned ? `Nv. ${c.level}${c.awakening ? ` · ${icon('awakening')}${c.awakening}` : ''}`
            : c.pool === 'farm' ? `${icon('flower')}Só na Fazenda` : 'Não obtida',
        })).join('')}</div>
      </section>`;
  }

  async function reload() {
    p = await api.get(`/api/profile/${encodeURIComponent(nickname)}`);
    if (ctx.alive) draw();
  }

  /** Galeria de molduras: a prévia é o seu próprio avatar; as que faltam mostram como conseguir. */
  function framesHtml(chosen) {
    const preview = (frame) => avatar({ ...p, frame }, 72);
    const none = `
      <button type="button" class="frame-opt ${chosen ? '' : 'selected'}" data-frame-pick="">
        <span class="fo-art">${preview(null)}</span>
        <span class="fo-name">Sem moldura</span>
        <span class="fo-sub">O avatar limpo, só com a corredora.</span>
      </button>`;
    return none + p.cosmetics.frame.map((f) => `
      <button type="button" class="frame-opt r${f.rarity} ${f.owned ? '' : 'locked'} ${chosen === f.id ? 'selected' : ''}"
        data-frame-pick="${esc(f.id)}" ${f.owned ? '' : 'aria-disabled="true"'}>
        <span class="fo-art">${preview(f)}${f.owned ? '' : `<span class="fo-lock">${icon('lock')}</span>`}</span>
        <span class="fo-name">${esc(f.name)} ${stars(f.rarity)}</span>
        <span class="fo-sub">${esc(f.description)}</span>
        ${f.owned ? (chosen === f.id ? `<span class="chip chip-green">${icon('check')}Equipada</span>` : '')
          : `<span class="fo-how">${f.sources.map((s) => esc(s)).join('<br>') || 'Em breve'}</span>`}
      </button>`).join('');
  }

  function customize() {
    const opts = (list, current, empty) => `<option value="">${empty}</option>${list.filter((i) => i.owned).map((i) =>
      `<option value="${esc(i.id)}" ${current === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}`;
    let frame = p.frame?.id || '';
    const modal = openModal({
      title: 'Personalizar perfil',
      icon: 'brush',
      tone: 'purple',
      wide: true,
      body: `
        <label class="field"><span>Título</span>
          <select class="select" data-title style="width:100%">${opts(p.cosmetics.title, p.title?.id, 'Sem título')}</select></label>
        <div class="field"><span>Moldura do avatar</span>
          <div class="frame-gallery" data-frames>${framesHtml(frame)}</div></div>
        <p class="small muted">Novos títulos e molduras vêm de conquistas e da Loja (aba Cosméticos). Para trocar a corredora que anda pelo mundo, use o botão "Trocar" no próprio mundo.</p>`,
      actions: [
        { label: 'Cancelar', onClick: (close) => close() },
        {
          label: 'Salvar',
          cls: 'btn-primary',
          onClick: async (close, btn) => {
            const body = {
              title_item_id: modal.el.querySelector('[data-title]').value || null,
              frame_item_id: frame || null,
            };
            if (await act(btn, () => api.put('/api/profile', body))) {
              close();
              toast(`${icon('brush')}<span>Perfil atualizado!</span>`, 'success');
              reload();
            }
          },
        },
      ],
    });
    const gallery = modal.el.querySelector('[data-frames]');
    gallery.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-frame-pick]');
      if (!opt || opt.getAttribute('aria-disabled') === 'true') return;
      frame = opt.dataset.framePick;
      gallery.querySelectorAll('[data-frame-pick]').forEach((o) => o.classList.toggle('selected', o === opt));
    });
  }

  function chooseFavorites() {
    let picked = p.favorites.map((f) => f.id);
    const modal = openModal({
      title: 'Escolha até 3 favoritas',
      icon: 'heart',
      tone: 'pink',
      wide: true,
      body: '<div class="select-grid" data-grid></div>',
      actions: [
        { label: 'Cancelar', onClick: (close) => close() },
        {
          label: 'Salvar',
          cls: 'btn-primary',
          onClick: async (close, btn) => {
            if (await act(btn, () => api.put('/api/profile', { favorites: picked }))) {
              close();
              toast(`${icon('heart')}<span>Favoritas atualizadas!</span>`, 'success');
              reload();
            }
          },
        },
      ],
    });
    const grid = modal.el.querySelector('[data-grid]');
    const drawGrid = () => {
      grid.innerHTML = p.roster.map((c) => {
        const idx = picked.indexOf(c.id);
        return `<button class="selectable ${idx >= 0 ? 'selected' : ''}" data-pick="${c.id}">
          ${idx >= 0 ? `<span class="sel-num">${idx + 1}</span>` : ''}
          ${charCard(c.character, { meta: `Nv. ${c.level} · ${icon('bolt')}${fmt(c.power)}` })}
        </button>`;
      }).join('');
    };
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      const id = Number(b.dataset.pick);
      if (picked.includes(id)) picked = picked.filter((x) => x !== id);
      else if (picked.length < 3) picked = [...picked, id];
      else toast(`${icon('warning')}<span>Máximo de 3 favoritas.</span>`, 'error');
      drawGrid();
    });
    drawGrid();
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-customize]')) customize();
    else if (e.target.closest('[data-favorites]')) chooseFavorites();
  });

  draw();
}

