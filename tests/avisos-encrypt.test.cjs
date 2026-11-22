// El servicio de avisos cifra el texto (RFC 8291 aes128gcm); aquí se descifra como lo haría el móvil.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const src = fs.readFileSync(__dirname + '/../tools/avisos-worker.js', 'utf8');
const code = src.slice(src.indexOf('const ub ='), src.indexOf('// Envía el aviso con su texto'));
const { encrypt } = new Function(code + '; return { encrypt };')();
const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));
test('el móvil puede descifrar el aviso', async () => {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const uaPublic = ecdh.getPublicKey(), auth = crypto.randomBytes(16);
  const sub = { keys: { p256dh: uaPublic.toString('base64url'), auth: auth.toString('base64url') } };
  const data = { items: [{ title: '💬 Mari dice', body: 'haz la cena', tag: 't' }] };
  const body = Buffer.from(await encrypt(sub, data));
  const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20], asPublic = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  assert.equal(rs, 4096); assert.equal(idlen, 65);
  const shared = ecdh.computeSecret(asPublic);
  const ikm = hkdf(auth, shared, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  assert.equal(plain[plain.length - 1], 2, 'delimitador de último registro');
  assert.deepEqual(JSON.parse(plain.subarray(0, plain.length - 1).toString()), data);
});
