// Servicio de avisos de CASA (Cloudflare Worker «casa-avisos»).
// - Cada móvil sube sus avisos de las próximas 48 h (/schedule) y se envían a su hora (revisión cada minuto).
// - Además, cualquiera de la casa puede mandar un aviso a una persona (/send): a ella misma a una hora,
//   «Mari dice: …» al otro, o el fin de un temporizador. Va al buzón de los móviles de esa persona.
// - Solo puede mandar quien tiene la clave privada de la casa (se guarda en los datos de Casa, no aquí).
// El aviso viaja sin contenido (solo un toque); el móvil pide el texto (/pending) y lo muestra.
// Secretos (no están en el repositorio): VAPID_JWK (clave privada) y VAPID_PUBLIC. Datos: KV «AVISOS».
const ORIGIN = 'https://s9nzw2sjc5-code.github.io';
const SUBJECT = 'https://s9nzw2sjc5-code.github.io/CASA/';
const PUSH_HOSTS = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
const TYPES = ['resumen', 'urgente', 'hora', 'citas', 'ringo', 'manana', 'timers', 'alarma', 'mensaje'];
const MAX_ITEMS = 80, MAX_INBOX = 50, MAX_QUEUE = 20;

const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
const person = (p) => /^[a-z0-9_-]{1,30}$/i.test(String(p || '')) ? String(p) : '';
const hex = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const deviceKey = async (endpoint) => 'd:' + (await hex(endpoint)).slice(0, 32);
const houseOf = async (k) => (typeof k === 'string' && k.length >= 20 && k.length <= 200 ? (await hex('casa:' + k)).slice(0, 32) : '');

function validSub(sub) {
  try {
    const u = new URL(sub.endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.test(u.hostname) && sub.endpoint.length < 1000 && sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string';
  } catch { return false; }
}
function cleanItem(x) {
  return { id: text(x && x.id, 60), at: Date.parse(x && x.at), title: text(x && x.title, 120), body: text(x && x.body, 300), tag: text(x && x.tag, 80), type: TYPES.includes(x && x.type) ? x.type : '' };
}
function cleanItems(items, max) {
  const now = Date.now();
  return (Array.isArray(items) ? items : []).map(cleanItem)
    .filter((x) => Number.isFinite(x.at) && x.at > now - 600e3 && x.at < now + 60 * 864e5 && x.title)
    .sort((a, b) => a.at - b.at).slice(0, max);
}

async function vapidAuth(env, endpoint) {
  const aud = new URL(endpoint).origin;
  const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT });
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}
// Cifrado del contenido del aviso (RFC 8291, aes128gcm): el móvil lo muestra directamente, sin tener que preguntar
const ub = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - String(s).length % 4) % 4)), (c) => c.charCodeAt(0));
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
async function encrypt(sub, data) {
  const uaPublic = ub(sub.keys.p256dh), authSecret = ub(sub.keys.auth), te = new TextEncoder();
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, cat(te.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(te.encode(JSON.stringify(data)), new Uint8Array([2]))));
  const header = new Uint8Array(21); header.set(salt, 0); new DataView(header.buffer).setUint32(16, 4096); header[20] = asPublic.length;
  return cat(header, asPublic, ct);
}
// Envía el aviso con su texto (o un toque sin texto si no hay nada que mandar)
async function poke(env, sub, items) {
  const headers = { Authorization: await vapidAuth(env, sub.endpoint), TTL: '86400', Urgency: 'high' };
  let body = null;
  if (items && items.length) {
    const data = { items: items.slice(-3).map((x) => ({ title: x.title, body: x.body, tag: x.tag })) };
    body = await encrypt(sub, data);
    Object.assign(headers, { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' });
  } else headers['Content-Length'] = '0';
  const res = await fetch(sub.endpoint, { method: 'POST', headers, body });
  return res.status;
}

async function index(env) { return (await env.AVISOS.get('idx', 'json')) || []; }
async function setIndex(env, keys) { await env.AVISOS.put('idx', JSON.stringify([...new Set(keys)].slice(0, 50))); }
async function dropDevice(env, key) { await env.AVISOS.delete(key); await setIndex(env, (await index(env)).filter((x) => x !== key)); }

// Pasa a la cola lo que ya toca (de sus avisos y de su buzón) y avisa al móvil
async function flush(env, key, dev) {
  const now = Date.now(), mute = new Set(dev.mute || []);
  const due = [...(dev.items || []), ...(dev.inbox || [])].filter((x) => x.at <= now && !mute.has(x.type));
  const dueIds = new Set(due);
  dev.items = (dev.items || []).filter((x) => x.at > now);
  dev.inbox = (dev.inbox || []).filter((x) => x.at > now);
  if (!due.length) { await env.AVISOS.put(key, JSON.stringify(dev)); return; }
  dev.queue = [...(dev.queue || []), ...due].slice(-MAX_QUEUE);
  const status = await poke(env, dev.sub, due).catch(() => 0);
  if (status === 404 || status === 410) await dropDevice(env, key);
  else await env.AVISOS.put(key, JSON.stringify(dev));
  return dueIds;
}
async function deliver(env) {
  const now = Date.now();
  for (const key of await index(env)) {
    const dev = await env.AVISOS.get(key, 'json');
    if (!dev || !dev.sub) continue;
    if ([...(dev.items || []), ...(dev.inbox || [])].some((x) => x.at <= now)) await flush(env, key, dev);
  }
}
async function houseDevices(env, house) {
  const out = [];
  for (const key of await index(env)) { const dev = await env.AVISOS.get(key, 'json'); if (dev && dev.house === house) out.push([key, dev]); }
  return out;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const path = new URL(req.url).pathname;
    if (req.method === 'GET' && path === '/') return json({ ok: true, service: 'casa-avisos' });
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
    const origin = req.headers.get('Origin');
    if (origin && origin !== ORIGIN) return json({ error: 'Origen no permitido' }, 403);
    let body;
    try { body = await req.json(); } catch { return json({ error: 'JSON no válido' }, 400); }
    if (!body || typeof body !== 'object') return json({ error: 'Datos no válidos' }, 400);

    // Avisos entre la casa: necesitan la clave de la casa
    if (path === '/status') {
      const house = await houseOf(body.houseKey);
      if (!house) return json({ error: 'Falta la clave de la casa' }, 403);
      const people = {};
      for (const [, dev] of await houseDevices(env, house)) if (dev.person) people[dev.person] = (people[dev.person] || 0) + 1;
      return json({ ok: true, people });
    }
    if (path === '/send' || path === '/cancel') {
      const house = await houseOf(body.houseKey);
      if (!house) return json({ error: 'Falta la clave de la casa' }, 403);
      const devs = await houseDevices(env, house);
      if (path === '/cancel') {
        const id = text(body.id, 60); let n = 0;
        for (const [key, dev] of devs) { const before = (dev.inbox || []).length; dev.inbox = (dev.inbox || []).filter((x) => x.id !== id); if (dev.inbox.length !== before) { n++; await env.AVISOS.put(key, JSON.stringify(dev)); } }
        return json({ ok: true, devices: n });
      }
      const to = (Array.isArray(body.to) ? body.to : [body.to]).map(person).filter(Boolean);
      const item = cleanItems([{ ...body, at: body.at || new Date().toISOString() }], 1)[0];
      if (!to.length || !item) return json({ error: 'Aviso no válido' }, 400);
      let n = 0;
      for (const [key, dev] of devs) {
        if (!to.includes(dev.person)) continue;
        dev.inbox = [...(dev.inbox || []).filter((x) => x.id !== item.id || !item.id), item].sort((a, b) => a.at - b.at).slice(-MAX_INBOX);
        n++;
        if (item.at <= Date.now()) await flush(env, key, dev); else await env.AVISOS.put(key, JSON.stringify(dev));
      }
      return json({ ok: true, devices: n });
    }

    const endpoint = String((body.sub && body.sub.endpoint) || body.endpoint || '');
    if (!endpoint) return json({ error: 'Falta la suscripción' }, 400);
    const key = await deviceKey(endpoint);
    if (path === '/subscribe' || path === '/schedule') {
      const old = (await env.AVISOS.get(key, 'json')) || {};
      const sub = body.sub || old.sub;
      if (!sub || !validSub(sub)) return json({ error: 'Suscripción no válida' }, 400);
      const house = (await houseOf(body.houseKey)) || old.house || '';
      const mute = (Array.isArray(body.mute) ? body.mute : old.mute || []).filter((t) => TYPES.includes(t));
      await env.AVISOS.put(key, JSON.stringify({ sub, person: person(body.person) || old.person || '', house, mute, items: cleanItems(body.items, MAX_ITEMS), inbox: old.inbox || [], queue: old.queue || [], at: Date.now() }));
      const idx = await index(env); if (!idx.includes(key)) await setIndex(env, [...idx, key]);
      return json({ ok: true });
    }
    if (path === '/unsubscribe') { await dropDevice(env, key); return json({ ok: true }); }
    if (path === '/pending') {
      const dev = await env.AVISOS.get(key, 'json');
      const queue = (dev && dev.queue) || [];
      if (dev && queue.length) { dev.queue = []; await env.AVISOS.put(key, JSON.stringify(dev)); }
      return json({ items: queue });
    }
    if (path === '/test') {
      const dev = await env.AVISOS.get(key, 'json');
      if (!dev || !dev.sub) return json({ error: 'Este móvil no está dado de alta' }, 404);
      const probe = { at: Date.now(), title: 'Casa · Prueba', body: 'Los avisos de Casa llegan a este móvil.', tag: 'casa-test' };
      dev.queue = [...(dev.queue || []), probe].slice(-MAX_QUEUE);
      await env.AVISOS.put(key, JSON.stringify(dev));
      const status = await poke(env, dev.sub, [probe]).catch(() => 0);
      return json({ ok: status >= 200 && status < 300, status });
    }
    return json({ error: 'No encontrado' }, 404);
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(deliver(env)); },
};
