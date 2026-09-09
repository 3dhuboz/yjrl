// Synthetic acceptance against the isolated review service only. Run via HeadSnap.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const base = 'https://yjrl-review.steve-700.workers.dev';
const secrets = JSON.parse(readFileSync('/home/steve/.local/share/yjrl/review-secrets.json', 'utf8'));
const basic = `Basic ${Buffer.from(`yjrl-review:${secrets.REVIEW_ACCESS_PASSWORD}`).toString('base64')}`;
let cookie = '';
async function call(path, { method = 'GET', body, token, raw = false, anonymous = false, navigation = false } = {}) {
  const headers = anonymous ? {} : { ...(cookie ? { Cookie: cookie } : { Authorization: basic }) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (navigation) headers['Sec-Fetch-Mode'] = 'navigate';
  if (body && !raw) headers['Content-Type'] = 'application/json';
  const result = await fetch(base + path, { method, headers, body: body ? (raw ? body : JSON.stringify(body)) : undefined, signal: AbortSignal.timeout(30000) });
  if (!anonymous && result.headers.get('Set-Cookie')) cookie = result.headers.get('Set-Cookie').split(';')[0];
  return result;
}
async function json(path, options, expected = 200) {
  const response = await call(path, options);
  assert.equal(response.status, expected, path);
  return response.json();
}

for (const path of ['/', '/register', '/api/health', '/service-worker.js']) {
  assert.equal((await call(path, { anonymous: true })).status, 401, `Anonymous ${path}`);
}
const page = await call('/register', { navigation: true });
assert.equal(page.status, 200);
assert.match(await page.text(), /<html/);
assert.equal(page.headers.get('Cache-Control'), 'no-store');
assert.equal((await json('/api/health')).status, 'ok');
const admin = await json('/api/auth/login', { method: 'POST', body: { email: secrets.ADMIN_EMAIL, password: secrets.ADMIN_PASSWORD, adultConfirmed: true } });
const readiness = await json('/api/admin/readiness', { token: admin.token });
for (const id of ['d1', 'r2', 'adult_accounts', 'durable_rate_limits', 'registration_duplicates', 'child_access_log', 'media_review_schema', 'image_processing']) {
  assert.equal(readiness.checks.find(check => check.id === id)?.status, 'pass', id);
}
const fees = await json('/api/registration-fees');
assert.equal(fees.season, '2027');
assert.equal(fees.paymentOptions.paypal, false);
const suffix = Date.now().toString(36);
const email = `synthetic-${suffix}@example.test`;
const form = {
  season: '2027', firstName: 'Synthetic', lastName: `Review-${suffix}`, dateOfBirth: '2018-03-05', ageGroup: 'U9',
  email, password: 'synthetic-acceptance-only-1234', adultConfirmed: true,
  guardianName: 'Synthetic Guardian', guardianEmail: email, guardianPhone: '0400000000',
  emergencyContact: { name: 'Synthetic Contact', phone: '0400000001', relationship: 'Guardian' },
  agreeToTerms: true, agreeToPhotoPolicy: true, paymentMethod: 'offline', quotedAmount: fees.fees.U9,
};
const parent = await json('/api/register-player', { method: 'POST', body: form }, 201);
assert.equal(parent.emailStatus, 'unavailable');
assert.equal(parent.user.role, 'parent');
await json('/api/register-player', { method: 'POST', body: form }, 409);
const children = await json('/api/yjrl/my-children', { token: parent.token });
assert.equal(children.length, 1);
assert.equal(children[0].registrationYear, '2027');
const childId = children[0]._id;

// A small coloured PNG with explicit synthetic metadata, generated without any real photo.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, payload) {
  const data = Buffer.concat([Buffer.from(type), payload]), output = Buffer.alloc(payload.length + 12);
  output.writeUInt32BE(payload.length, 0); data.copy(output, 4); output.writeUInt32BE(crc32(data), output.length - 4); return output;
}
const header = Buffer.alloc(13); header.writeUInt32BE(120); header.writeUInt32BE(80, 4); header[8] = 8; header[9] = 2;
const pixels = Buffer.alloc((120 * 3 + 1) * 80);
for (let y = 0; y < 80; y++) for (let x = 0; x < 120; x++) {
  const offset = y * 361 + 1 + x * 3;
  pixels[offset] = x < 60 ? 240 : 20; pixels[offset + 1] = y < 40 ? 220 : 20; pixels[offset + 2] = x >= 60 ? 240 : 20;
}
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header),
  chunk('tEXt', Buffer.from('Author\0SyntheticOwnerOnly')), chunk('tEXt', Buffer.from('Location\0SyntheticGPSOnly')),
  chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
const before = await json('/api/yjrl/safety/uploads', { token: admin.token });
const upload = new FormData(); upload.append('file', new File([png], 'synthetic-owner-metadata.png', { type: 'image/png' }));
upload.append('category', 'player'); upload.append('playerIds', JSON.stringify([childId]));
const stored = await json('/api/upload', { method: 'POST', body: upload, token: admin.token, raw: true }, 201);
assert.equal(stored.status, 'pending_review'); assert.equal(stored.url, null);
const uploads = await json('/api/yjrl/safety/uploads', { token: admin.token });
const photo = uploads.find(item => !before.some(old => old.key === item.key));
assert.ok(photo); assert.match(photo.key, /^player\/[a-f0-9-]+\.webp$/);
const path = `/api/media?key=${encodeURIComponent(photo.key)}`;
assert.equal((await call(path)).status, 404);
assert.equal((await call(`/api/media/preview?key=${encodeURIComponent(photo.key)}`, { token: parent.token })).status, 403);
const preview = await call(`/api/media/preview?key=${encodeURIComponent(photo.key)}`, { token: admin.token });
assert.equal(preview.status, 200); assert.equal(preview.headers.get('Content-Type'), 'image/webp');
const bytes = Buffer.from(await preview.arrayBuffer());
assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
const chunks = [];
for (let i = 12; i < bytes.length;) { const type = bytes.toString('ascii', i, i + 4); chunks.push(type); assert.ok(['VP8 ', 'VP8L', 'VP8X', 'ALPH'].includes(type)); const size = bytes.readUInt32LE(i + 4); i += 8 + size + (size % 2); }
for (const text of ['SyntheticOwnerOnly', 'SyntheticGPSOnly', 'synthetic-owner-metadata.png']) assert.ok(!bytes.includes(Buffer.from(text)));
mkdirSync('.wrangler/review-acceptance', { recursive: true });
writeFileSync('.wrangler/review-acceptance/synthetic-processed.webp', bytes);
const decision = { key: photo.key, status: 'approved', reviewVersion: photo.reviewVersion, expectedSha256: photo.sha256,
  containsChildren: true, allChildrenIdentified: true, playerIds: [childId], reviewNotes: 'Synthetic coloured test pattern only; verifies consent policy without photographing children.' };
const approved = await json('/api/yjrl/safety/uploads/review', { method: 'PUT', body: decision, token: admin.token });
assert.equal((await call(path)).status, 200);
await json('/api/yjrl/safety/uploads/review', { method: 'PUT', body: decision, token: admin.token }, 409);
await json(`/api/yjrl/players/${childId}`, { method: 'PUT', body: { mediaConsent: false }, token: admin.token });
assert.equal((await call(path)).status, 404);
const rejected = await json('/api/yjrl/safety/uploads/review', { method: 'PUT', token: admin.token,
  body: { key: photo.key, status: 'rejected', reviewVersion: approved.reviewVersion, reviewNotes: 'Synthetic acceptance complete; remove test object.' } });
assert.equal(rejected.cleanupPending, false);
assert.equal((await call(`/api/media/preview?key=${encodeURIComponent(photo.key)}`, { token: admin.token })).status, 404);
console.log(JSON.stringify({ result: 'passed', environment: 'isolated review', checks: ['gateway denial', 'SPA route', 'admin login/readiness', 'D1 registration and duplicate claim', 'guardian read audit', 'real Images PNG to WebP', 'metadata removal', 'private review', 'stale review rejection', 'consent withdrawal', 'R2 object cleanup'], outputChunks: chunks, outputBytes: bytes.length, emailSent: false, paymentMade: false }));
