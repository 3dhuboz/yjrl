import assert from 'node:assert/strict';
import { test } from 'node:test';
import review from '../src/review.ts';
import { environment, actor } from './support.mjs';

const password = 'synthetic-review-password-not-a-secret-1234';
function envFor(t) {
  const env = { ...environment(t), ENVIRONMENT: 'review', REVIEW_ACCESS_PASSWORD: password,
    ASSETS: { fetch: async () => new Response('<html>private review</html>', { headers: { 'Content-Type': 'text/html' } }) } };
  return env;
}
const basic = { Authorization: `Basic ${btoa(`yjrl-review:${password}`)}` };
const get = (env, path, headers = {}) => review.fetch(new Request(`https://review.example.test${path}`, { headers }), env, {});

test('review gateway protects assets, deep links and APIs and fails closed when misconfigured', async (t) => {
  const env = envFor(t);
  for (const path of ['/', '/register', '/assets/app.js', '/service-worker.js', '/api/health', '/api/registration-fees']) {
    for (const headers of [{}, { Authorization: 'Basic invalid' }, { Cookie: '__Host-yjrl_review=forged' }]) {
      const response = await get(env, path, headers);
      assert.equal(response.status, 401, path);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.ok(!(await response.text()).includes('private review</html>'));
    }
  }
  for (const overrides of [{ REVIEW_ACCESS_PASSWORD: undefined }, { REVIEW_ACCESS_PASSWORD: 'short' }, { ENVIRONMENT: 'production' }]) {
    assert.equal((await get({ ...env, ...overrides }, '/', basic)).status, 503);
  }
});

test('review session permits adult application authentication and rotates with gateway password', async (t) => {
  const env = envFor(t);
  const initial = await get(env, '/register', basic);
  assert.equal(initial.status, 200);
  const setCookie = initial.headers.get('Set-Cookie');
  assert.match(setCookie, /Secure; HttpOnly; SameSite=Strict/);
  const Cookie = setCookie.split(';')[0];
  const actorHeaders = await actor(env, 'review-admin', 'admin');
  const response = await get(env, '/api/auth/me', { Cookie, ...actorHeaders });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).role, 'admin');
  assert.equal((await get({ ...env, REVIEW_ACCESS_PASSWORD: password + '-rotated' }, '/', { Cookie })).status, 401);
  const sw = await get(env, '/service-worker.js', { Cookie });
  assert.match(await sw.text(), /registration.unregister/);
});
