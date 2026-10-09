// Inicialização, autenticação, HUD, navegação e roteador por hash (#/area/param).

import { api, getToken, onState, onUnauthorized, refreshMe, setMe, setToken, state } from './store.js';
import { connect } from './realtime.js';
import { mountFeed } from './feed.js';
import { avatar, esc, fmt, icon, rankBadge, toastError } from './ui.js';

import * as worldView from './views/world.js';
import * as hubView from './views/hub.js';
import * as gachaView from './views/gacha.js';
import * as trainingView from './views/training.js';
import * as afkView from './views/afk.js';
import * as inventoryView from './views/inventory.js';
import * as missionsView from './views/missions.js';
import * as shopView from './views/shop.js';
import * as profileView from './views/profile.js';
import * as rankingView from './views/ranking.js';

export const AREAS = [
  { id: 'mundo', icon: 'world', label: 'Mundo', view: worldView },
  { id: 'praca', icon: 'plaza', label: 'Praça', view: hubView },
  { id: 'gacha', icon: 'gacha', label: 'Templo', view: gachaView },
  { id: 'treino', icon: 'training', label: 'Treino', view: trainingView },
  { id: 'afk', icon: 'farm', label: 'Fazenda', view: afkView },
  { id: 'armazem', icon: 'storage', label: 'Armazém', view: inventoryView },
  { id: 'missoes', icon: 'missions', label: 'Missões', view: missionsView },
  { id: 'loja', icon: 'shop', label: 'Loja', view: shopView },
  { id: 'perfil', icon: 'home', label: 'Casa', view: profileView },
  { id: 'ranking', icon: 'ranking', label: 'Ranking', view: rankingView },
];
const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));
AREA_BY_ID.mapa = AREA_BY_ID.mundo; // links antigos

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------- roteador

let currentCtx = null;
let currentArea = null;

function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'mundo', params: parts.slice(1) };
}

function makeCtx() {
  const timers = [];
  const cleanups = [];
  return {
    alive: true,
    interval(fn, ms) { timers.push(setInterval(fn, ms)); },
    onCleanup(fn) { cleanups.push(fn); },
    cleanup() {
      this.alive = false;
      timers.forEach(clearInterval);
      cleanups.forEach((fn) => fn());
    },
  };
}

async function route() {
  if (!state.me) return;
  const { name, params } = parseHash();
  const area = AREA_BY_ID[name] || AREA_BY_ID.mundo;

  currentCtx?.cleanup();
  worldView.noteRoute(currentArea);
  currentArea = area.id;
  const ctx = makeCtx();
  currentCtx = ctx;

  renderNav(area.id);
  document.body.classList.toggle('in-world', area.id === 'mundo');
  $('feed').classList.remove('open');
  const el = document.createElement('div');
  el.className = 'view';
  el.innerHTML = '<div class="loading">Carregando…</div>';
  $('main').replaceChildren(el);
  window.scrollTo({ top: 0 });
  document.title = `${area.label} · UmaWorld`;

  try {
    await area.view.render(el, params, ctx);
  } catch (e) {
    console.error(e);
    if (!ctx.alive) return;
    el.innerHTML = `<div class="panel empty">${icon('warning')} ${esc(e.message)}<br><br>
      <button class="btn" data-retry>Tentar de novo</button></div>`;
    el.querySelector('[data-retry]').onclick = route;
  }
}

// ------------------------------------------------------------- HUD e navegação

function navBadge(id) {
  const b = state.badges;
  if (id === 'missoes' && b.missions) return `<span class="badge">${b.missions}</span>`;
  if (id === 'afk' && b.afk_full) return '<span class="badge">!</span>';
  return '';
}

function renderNav(activeId = currentArea || parseHash().name) {
  const html = AREAS.map((a) => `
    <a class="nav-item ${a.id === activeId ? 'active' : ''}" href="#/${a.id}" ${a.id === activeId ? 'aria-current="page"' : ''}>
      ${icon(a.icon, 'ni')}<span>${a.label}</span>${navBadge(a.id)}
    </a>`).join('');
  $('sidenav').innerHTML = html;
  $('bottomnav').innerHTML = html;
}

const lastValues = {};

function renderHud() {
  const me = state.me;
  if (!me) return;
  const items = [
    ['coins', 'coin', me.coins, 'Moedas', ''],
    ['carats', 'carat', me.carats, 'Carats', ''],
    ['tickets', 'ticket', me.tickets, 'Tickets de Recrutamento', ''],
    ['fragments', 'fragment', me.fragments, 'Fragmentos Estelares', 'optional'],
  ];
  $('hud-currencies').innerHTML = items.map(([key, name, value, title, cls]) => {
    const changed = lastValues[key] !== undefined && lastValues[key] !== value;
    lastValues[key] = value;
    return `<span class="cur m-${key} ${cls} ${changed ? 'bump' : ''}" title="${title}">${icon(name, 'ci')}${fmt(value)}</span>`;
  }).join('');
  $('hud-user').innerHTML = `${avatar(me, 40)}
    <span class="hu-text"><span class="hu-name">${esc(me.nickname)}</span>
    <span class="hu-sub">Nv. ${me.level} · ${rankBadge(me.rank)}</span></span>`;
}

onState(() => {
  renderHud();
  renderNav();
});

// ------------------------------------------------------------- Chat Global

let feedMounted = false;

function mountGameFeed() {
  if (feedMounted) return;
  feedMounted = true;
  mountFeed($('feed'), {
    onNew: () => {
      if (!$('feed').classList.contains('open') && getComputedStyle($('feed-toggle')).display !== 'none') {
        $('feed-unread').hidden = false;
      }
    },
  });
  $('feed-toggle').addEventListener('click', () => {
    if ($('feed').classList.toggle('open')) $('feed-unread').hidden = true;
  });
}

// ------------------------------------------------------------- autenticação

let authMode = 'login';
let authFeedMounted = false;

function showAuth() {
  $('app').hidden = true;
  $('auth-screen').hidden = false;
  document.title = 'UmaWorld — entre na pista';
  if (!authFeedMounted) {
    authFeedMounted = true;
    mountFeed($('auth-feed'), { linkProfiles: false });
  }
}

async function showApp() {
  $('auth-screen').hidden = true;
  $('app').hidden = false;
  mountGameFeed();
  renderHud();
  if (!location.hash) history.replaceState(null, '', '#/mundo');
  await route();
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('[data-auth-tab]').forEach((t) => t.classList.toggle('active', t.dataset.authTab === mode));
  $('auth-submit').textContent = mode === 'login' ? 'Entrar' : 'Criar conta e começar';
  $('auth-hint').textContent = mode === 'login'
    ? 'Que bom te ver de novo na pista!'
    : 'Apelido com 3–16 letras, números ou _. Você ganha um kit inicial com 10 tickets!';
  $('auth-form').password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('auth-error').textContent = '';
}

document.querySelectorAll('[data-auth-tab]').forEach((tab) => {
  tab.addEventListener('click', () => setAuthMode(tab.dataset.authTab));
});

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const nickname = form.nickname.value.trim();
  const password = form.password.value;
  const error = $('auth-error');
  error.textContent = '';
  if (authMode === 'register' && !/^[A-Za-z0-9_]{3,16}$/.test(nickname)) {
    error.textContent = 'O apelido deve ter de 3 a 16 caracteres: letras, números ou _.';
    return;
  }
  if (authMode === 'register' && password.length < 6) {
    error.textContent = 'A senha deve ter pelo menos 6 caracteres.';
    return;
  }
  const button = $('auth-submit');
  button.disabled = true;
  try {
    const res = await api.post(authMode === 'login' ? '/api/auth/login' : '/api/auth/register', { nickname, password });
    setToken(res.token);
    setMe(res.me);
    connect(res.token);
    form.reset();
    await refreshMe().catch(() => {});
    await showApp();
  } catch (err) {
    error.textContent = err.message;
  } finally {
    button.disabled = false;
  }
});

function logout() {
  setToken(null);
  currentCtx?.cleanup();
  currentArea = null;
  setMe(null);
  connect(null);
  history.replaceState(null, '', location.pathname);
  showAuth();
}

$('logout').addEventListener('click', logout);
onUnauthorized(() => {
  if (state.me) {
    logout();
    toastError('Sua sessão expirou. Entre novamente.');
  }
});

window.addEventListener('hashchange', route);

// ------------------------------------------------------------- boot

async function loadIcons() {
  try {
    const svg = await fetch('/img/icons.svg').then((r) => r.text());
    document.body.insertAdjacentHTML('afterbegin', svg);
  } catch { /* sem ícones o jogo continua utilizável */ }
}

(async function boot() {
  await loadIcons();
  const token = getToken();
  connect(token);
  if (!token) {
    showAuth();
    return;
  }
  try {
    await refreshMe();
    await showApp();
  } catch {
    setToken(null);
    connect(null);
    showAuth();
  }
}());
