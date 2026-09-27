import assert from 'node:assert/strict';
import { test } from 'node:test';
import { environment, actor } from './support.mjs';
import auth from '../src/routes/auth.ts';
import { hashPassword } from '../src/lib/password.ts';
import adultAccount from '../../shared/adultAccount.json';

const details = { firstName: 'Test Adult', email: 'adult@example.test', password: 'test-password-only', adultConfirmed: true };
const post = (env, path, body) => auth.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, env);

test('self-registration accepts only explicitly declared adult parent accounts', async (t) => {
  const env = environment(t);
  for (const role of ['player', 'coach', 'admin', 'dev', 'unknown', null, {}]) {
    assert.equal((await post(env, '/register', { ...details, role })).status, 403);
  }
  for (const adultConfirmed of [undefined, false, 'true', 1, {}]) {
    assert.equal((await post(env, '/register', { ...details, adultConfirmed })).status, 400);
  }
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);
  const response = await post(env, '/register', details);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const saved = await response.json();
  assert.equal(saved.user.role, 'parent');
  const row = env.DB.sqlite.prepare('SELECT * FROM users').get();
  assert.ok(row.adult_attested_at);
  assert.equal(row.adult_attestation_version, adultAccount.version);
  assert.equal((await auth.request('/me', { headers: { Authorization: `Bearer ${saved.token}` } }, env)).status, 200);
});

test('malformed account and login input returns validation errors without creating users', async (t) => {
  const env = environment(t);
  for (const body of [null, [], 7, 'invalid', { ...details, email: {} }, { ...details, password: 'x'.repeat(129) }]) {
    for (const path of ['/register', '/login']) assert.equal((await post(env, path, body)).status, 400);
  }
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);
});

test('legacy junior credentials and already issued tokens cannot authenticate', async (t) => {
  const env = environment(t);
  const headers = await actor(env, 'junior', 'player');
  env.DB.sqlite.prepare('UPDATE users SET password_hash = ?, adult_attestation_version = ? WHERE id = ?')
    .run(await hashPassword(details.password), adultAccount.version, 'junior');
  assert.equal((await post(env, '/login', { ...details, email: 'junior@example.test' })).status, 403);
  assert.equal((await auth.request('/me', { headers }, env)).status, 403);
  assert.equal(env.DB.sqlite.prepare("SELECT role FROM users WHERE id = 'junior'").get().role, 'player');
});

test('existing adults must sign in and attest before old sessions regain access', async (t) => {
  const env = environment(t);
  const headers = await actor(env, 'parent', 'parent');
  env.DB.sqlite.prepare('UPDATE users SET password_hash = ?, adult_attestation_version = NULL, adult_attested_at = NULL WHERE id = ?')
    .run(await hashPassword(details.password), 'parent');
  assert.equal((await auth.request('/me', { headers }, env)).status, 401);
  for (const adultConfirmed of [false, 'true', undefined]) {
    assert.equal((await post(env, '/login', { ...details, email: 'parent@example.test', adultConfirmed })).status, 400);
    assert.equal(env.DB.sqlite.prepare("SELECT adult_attested_at FROM users WHERE id = 'parent'").get().adult_attested_at, null);
  }
  assert.equal((await post(env, '/login', { ...details, email: 'parent@example.test', password: 'wrong-password' })).status, 401);
  const response = await post(env, '/login', { ...details, email: 'parent@example.test' });
  assert.equal(response.status, 200);
  const { token } = await response.json();
  assert.equal((await auth.request('/me', { headers: { Authorization: `Bearer ${token}` } }, env)).status, 200);
  env.DB.sqlite.exec("UPDATE users SET is_active = 0 WHERE id = 'parent'");
  assert.equal((await auth.request('/me', { headers: { Authorization: `Bearer ${token}` } }, env)).status, 401);
});
