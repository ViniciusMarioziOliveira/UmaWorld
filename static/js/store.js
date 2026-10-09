// Estado global do jogador + cliente da API.

const TOKEN_KEY = 'umaworld.token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* modo privado: o login dura só esta aba */ }
}

export const state = {
  me: null,
  badges: { missions: 0, afk_full: false, afk_ready: false, afk_hours: 0, afk_storage_hours: 8 },
};

const subscribers = new Set();

export function onState(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify() {
  subscribers.forEach((fn) => fn(state));
}

export function setMe(me, badges) {
  if (me !== undefined) state.me = me;
  if (badges) state.badges = badges;
  notify();
}

let unauthorizedHandler = () => {};
export function onUnauthorized(fn) { unauthorizedHandler = fn; }

let refreshTimer = null;
function scheduleRefresh() {
  // Depois de qualquer ação, atualiza os avisos (missões prontas, Farm AFK...).
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { if (getToken()) refreshMe().catch(() => {}); }, 600);
}

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Sem conexão com o servidor.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* resposta sem corpo */ }

  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/api/auth/')) unauthorizedHandler();
    const detail = data && typeof data.detail === 'string' ? data.detail : `Erro ${res.status}`;
    throw new Error(detail);
  }
  if (data && data.me && state.me) {
    state.me = data.me;
    notify();
  }
  if (method !== 'GET') scheduleRefresh();
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  put: (path, body = {}) => request('PUT', path, body),
};

export async function refreshMe() {
  const res = await request('GET', '/api/me');
  setMe(res.me, res.badges);
  return res;
}
