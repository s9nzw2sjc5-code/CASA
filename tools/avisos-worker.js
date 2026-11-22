// Servicio de avisos de CASA (Cloudflare Worker «casa-avisos»).
// Cada móvil sube los avisos de las próximas 48 h; cada 5 minutos se envían los que tocan.
// El aviso viaja sin contenido (solo un toque); el móvil pide el texto aquí y lo muestra.
// Secretos (no están en el repositorio): VAPID_JWK (clave privada) y VAPID_PUBLIC. Datos: KV «AVISOS».
const ORIGIN = 'https://s9nzw2sjc5-code.github.io';
const SUBJECT = 'https://s9nzw2sjc5-code.github.io/CASA/';
const PUSH_HOSTS = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
const MAX_ITEMS = 80, MAX_QUEUE = 20;

const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, n);

async function deviceKey(endpoint) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return 'd:' + [...new Uint8Array(h)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function validSub(sub) {
  try {
    const u = new URL(sub.endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.test(u.hostname) && sub.endpoint.length < 1000 && sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string';
  } catch { return false; }
}
function cleanItems(items) {
  const now = Date.now();
  return (Array.isArray(items) ? items : []).map((x) => ({ at: Date.parse(x && x.at), title: text(x && x.title, 120), body: text(x && x.body, 300), tag: text(x && x.tag, 80) }))
    .filter((x) => Number.isFinite(x.at) && x.at > now - 600e3 && x.at < now + 3 * 864e5 && x.title)
    .sort((a, b) => a.at - b.at).slice(0, MAX_ITEMS);
}

async function vapidAuth(env, endpoint) {
  const aud = new URL(endpoint).origin;
  const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT });
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}
// Toque sin contenido: el móvil pregunta luego qué mostrar (/pending)
async function poke(env, sub) {
  const res = await fetch(sub.endpoint, { method: 'POST', headers: { Authorization: await vapidAuth(env, sub.endpoint), TTL: '86400', Urgency: 'normal', 'Content-Length': '0' } });
  return res.status;
}

async function deliver(env) {
  let cursor;
  do {
    const page = await env.AVISOS.list({ prefix: 'd:', cursor });
    for (const k of page.keys) {
      const dev = await env.AVISOS.get(k.name, 'json');
      if (!dev || !dev.sub) continue;
      const now = Date.now(), due = (dev.items || []).filter((x) => x.at <= now);
      if (!due.length) continue;
      dev.items = dev.items.filter((x) => x.at > now);
      dev.queue = [...(dev.queue || []), ...due].slice(-MAX_QUEUE);
      const status = await poke(env, dev.sub).catch(() => 0);
      if (status === 404 || status === 410) await env.AVISOS.delete(k.name);
      else await env.AVISOS.put(k.name, JSON.stringify(dev));
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
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
    const endpoint = String((body.sub && body.sub.endpoint) || body.endpoint || '');
    if (!endpoint) return json({ error: 'Falta la suscripción' }, 400);
    const key = await deviceKey(endpoint);
    if (path === '/subscribe' || path === '/schedule') {
      const old = (await env.AVISOS.get(key, 'json')) || {};
      const sub = body.sub || old.sub;
      if (!sub || !validSub(sub)) return json({ error: 'Suscripción no válida' }, 400);
      await env.AVISOS.put(key, JSON.stringify({ sub, items: cleanItems(body.items), queue: old.queue || [], at: Date.now() }));
      return json({ ok: true });
    }
    if (path === '/unsubscribe') { await env.AVISOS.delete(key); return json({ ok: true }); }
    if (path === '/pending') {
      const dev = await env.AVISOS.get(key, 'json');
      const queue = (dev && dev.queue) || [];
      if (dev && queue.length) { dev.queue = []; await env.AVISOS.put(key, JSON.stringify(dev)); }
      return json({ items: queue });
    }
    if (path === '/test') {
      const dev = await env.AVISOS.get(key, 'json');
      if (!dev || !dev.sub) return json({ error: 'Este móvil no está dado de alta' }, 404);
      dev.queue = [...(dev.queue || []), { at: Date.now(), title: 'Casa · Prueba', body: 'Los avisos de Casa llegan a este móvil.', tag: 'casa-test' }].slice(-MAX_QUEUE);
      await env.AVISOS.put(key, JSON.stringify(dev));
      const status = await poke(env, dev.sub).catch(() => 0);
      return json({ ok: status >= 200 && status < 300, status });
    }
    return json({ error: 'No encontrado' }, 404);
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(deliver(env)); },
};
