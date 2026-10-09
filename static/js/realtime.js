// Conexão WebSocket com o Chat Global (com reconexão automática).

export const live = {
  events: [],
  online: [],
  viewers: 0,
  connected: false,
};

const MAX_EVENTS = 100;
const listeners = new Set();
let socket = null;
let token = null;
let retry = 0;
let reconnectTimer = null;
let pingTimer = null;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(type, payload) {
  listeners.forEach((fn) => fn(type, payload));
}

function mergeEvents(incoming) {
  const byId = new Map(live.events.map((e) => [e.id, e]));
  incoming.forEach((e) => byId.set(e.id, e));
  live.events = [...byId.values()].sort((a, b) => a.id - b.id).slice(-MAX_EVENTS);
}

export function connect(newToken = null) {
  token = newToken;
  retry = 0;
  open();
}

function open() {
  clearTimeout(reconnectTimer);
  clearInterval(pingTimer);
  if (socket) {
    socket.onclose = null;
    socket.close();
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  const ws = new WebSocket(url);
  socket = ws;

  ws.onopen = () => {
    retry = 0;
    live.connected = true;
    emit('status');
    pingTimer = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 25000);
  };

  ws.onmessage = (msg) => {
    let data;
    try { data = JSON.parse(msg.data); } catch { return; }
    if (data.type === 'hello') {
      mergeEvents(data.feed || []);
      live.online = data.online || [];
      live.viewers = data.viewers || 0;
      emit('reset');
      emit('presence');
    } else if (data.type === 'feed') {
      const known = live.events.some((e) => e.id === data.event.id);
      mergeEvents([data.event]);
      if (!known) emit('feed', data.event);
    } else if (data.type === 'presence') {
      live.online = data.online || [];
      live.viewers = data.viewers || 0;
      emit('presence');
    }
  };

  ws.onclose = () => {
    clearInterval(pingTimer);
    live.connected = false;
    emit('status');
    const delay = Math.min(30000, 1000 * 2 ** retry);
    retry += 1;
    reconnectTimer = setTimeout(open, delay);
  };
}
