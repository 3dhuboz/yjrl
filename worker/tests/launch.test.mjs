import assert from 'node:assert/strict';
import { test } from 'node:test';
import { environment, actor } from './support.mjs';
import register from '../src/routes/register.ts';
import auth from '../src/routes/auth.ts';
import worker from '../src/index.ts';
import { registrationOpen, memberAccessOpen } from '../src/lib/launch.ts';
import { validateRegistrationFees, registrationFee } from '../../client/src/registrationFees.mjs';

test('default and incomplete launch settings cannot open registration', async (t) => {
  assert.equal(registrationOpen({}), false);
  assert.equal(memberAccessOpen({}), false);
  const env = environment(t);
  for (const overrides of [
    { REGISTRATIONS_OPEN: undefined }, { REGISTRATIONS_OPEN: 'false' },
    { MEMBER_ACCESS_OPEN: undefined }, { MEMBER_ACCESS_OPEN: 'false' },
    { CHILD_SAFETY_SIGNOFF: undefined }, { CHILD_SAFETY_SIGNOFF: 'pending' },
    { SEASON_DETAILS_CONFIRMED: undefined }, { SEASON_DETAILS_CONFIRMED: '2026' },
  ]) {
    const closed = { ...env, ...overrides };
    const response = await register.request('/registration-fees', {}, closed);
    assert.equal(response.status, 200);
    const details = validateRegistrationFees(await response.json(), '2027');
    assert.equal(details.registrationOpen, false);
    assert.deepEqual(details.fees, {});
    assert.deepEqual(details.paymentOptions, { paypal: false, offline: false });
    assert.equal(registrationFee(details, 'U9'), null);
    assert.equal((await register.request('/register-player', { method: 'POST', body: '{}' }, closed)).status, 503);
    assert.equal((await auth.request('/register', { method: 'POST', body: '{}' }, closed)).status, 503);
  }
  for (const table of ['users', 'players', 'registrations']) assert.equal(env.DB.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
  assert.equal(registrationOpen(env), true);
});

test('closed member access stops existing parent and coach sessions while retaining admin preparation', async (t) => {
  const env = { ...environment(t), MEMBER_ACCESS_OPEN: 'false' };
  for (const role of ['parent', 'coach', 'admin', 'dev']) {
    const headers = await actor(env, role, role);
    const response = await auth.request('/me', { headers }, env);
    assert.equal(response.status, ['admin', 'dev'].includes(role) ? 200 : 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  for (const action of ['resume', 'capture']) {
    assert.equal((await register.request(`/register-player/example/${action}`, { method: 'POST', body: '{}' }, env)).status, 503);
  }
});

test('closing new registration does not strand approved members with existing checkout links', async (t) => {
  const env = { ...environment(t), REGISTRATIONS_OPEN: 'false' };
  const headers = await actor(env, 'parent', 'parent');
  assert.equal((await auth.request('/me', { headers }, env)).status, 200);
  assert.equal(registrationOpen(env), false);
  // Invalid state is checked rather than a blanket closure. No payment is made.
  assert.equal((await register.request('/register-player/example/resume', { method: 'POST', body: '{}' }, env)).status, 403);
});

test('production CORS accepts configured origins and refuses local or unapproved preview origins', async (t) => {
  const env = environment(t);
  for (const origin of ['https://yjrl.pages.dev', 'https://unknown.yjrl.pages.dev', 'http://localhost:5173', 'https://yjrl.pages.dev.attacker.test']) {
    const response = await worker.fetch(new Request('https://api.example.test/api/health', { headers: { Origin: origin } }), env);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin === 'https://yjrl.pages.dev' ? origin : null);
  }
});
