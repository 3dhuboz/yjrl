import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Hono } from 'hono';
import { environment } from './support.mjs';
import { rateLimit, cleanupRateLimits } from '../src/middleware/rateLimit.ts';
import worker from '../src/index.ts';

function service(scope = 'test') {
  const app = new Hono();
  app.use('*', rateLimit(scope, 5, 60));
  app.all('*', c => c.json({ accepted: true }));
  return app;
}
const request = { method: 'POST', headers: { 'CF-Connecting-IP': '192.0.2.10' } };

test('independent instances share one atomic admission limit under concurrent requests', async (t) => {
  const env = environment(t);
  const instances = [service(), service()];
  const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => instances[i % 2].request('/', request, env)));
  assert.equal(responses.filter(r => r.status === 200).length, 5);
  assert.equal(responses.filter(r => r.status === 429).length, 15);
  const limited = responses.find(r => r.status === 429);
  assert.equal(limited.headers.get('Cache-Control'), 'no-store');
  const body = await limited.json();
  assert.ok(body.retryAfter > 0 && body.retryAfter <= 60);
  assert.equal(limited.headers.get('Retry-After'), String(body.retryAfter));
  const rows = env.DB.sqlite.prepare('SELECT * FROM rate_limit_buckets').all();
  assert.equal(rows.length, 1);
  assert.match(rows[0].bucket_key, /^[a-f0-9]{64}$/);
  assert.equal(rows[0].request_count, 6);
  assert.ok(!JSON.stringify(rows).includes('192.0.2.10'));
  assert.equal((await service().request('/', request, env)).status, 429);
});

test('expiry restarts admission and scope/address buckets do not interfere', async (t) => {
  const env = environment(t);
  const app = service();
  for (let i = 0; i < 5; i++) assert.equal((await app.request('/', request, env)).status, 200);
  assert.equal((await app.request('/', request, env)).status, 429);
  assert.equal((await service('another-scope').request('/', request, env)).status, 200);
  assert.equal((await app.request('/', { method: 'POST', headers: { 'CF-Connecting-IP': '192.0.2.11' } }, env)).status, 200);
  env.DB.sqlite.exec('UPDATE rate_limit_buckets SET reset_at = 0');
  assert.equal((await app.request('/', request, env)).status, 200);
  await cleanupRateLimits(env);
  const rows = env.DB.sqlite.prepare('SELECT * FROM rate_limit_buckets').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].request_count, 1);
});

test('untrusted forwarding headers cannot evade the missing-address limit', async (t) => {
  const env = environment(t);
  for (let i = 0; i < 7; i++) {
    const response = await service().request('/', { method: 'POST', headers: { 'X-Forwarded-For': `192.0.2.${i}`, 'X-Real-IP': `192.0.2.${i}` } }, env);
    assert.equal(response.status, i < 5 ? 200 : 429);
  }
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM rate_limit_buckets').get().n, 1);
});

test('unavailable storage fails closed while unmetered methods remain available', async (t) => {
  const env = environment(t);
  env.DB.sqlite.exec('DROP TABLE rate_limit_buckets');
  const app = service();
  const response = await app.request('/', request, env);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '60');
  for (const method of ['GET', 'OPTIONS']) assert.equal((await app.request('/', { method }, env)).status, 200);
});

test('deployed route wiring protects every sensitive endpoint and exposes retry headers', async (t) => {
  const env = environment(t);
  for (const [path, max] of [
    ['/api/auth/login', 10], ['/api/auth/register', 5], ['/api/register-player', 5],
    ['/api/register-player/test/resume', 30], ['/api/yjrl/chat', 120],
    ['/api/upload', 20], ['/api/yjrl/safety/reports', 30],
  ]) {
    for (let i = 0; i <= max; i++) {
      const response = await worker.fetch(new Request(`https://api.example.test${path}`, {
        ...request, headers: { ...request.headers, Origin: 'https://yjrl.pages.dev', 'Content-Type': 'application/json' }, body: '{}',
      }), env);
      if (i === max) {
        assert.equal(response.status, 429, path);
        assert.match(response.headers.get('Access-Control-Expose-Headers'), /Retry-After/i);
      } else assert.notEqual(response.status, 429, `${path} request ${i + 1}`);
    }
  }
  const capture = await worker.fetch(new Request('https://api.example.test/api/register-player/test/capture', request), env);
  assert.equal(capture.status, 429, 'resume and capture share the checkout scope');
});

test('scheduled expiry cleanup runs even when email is not configured', async (t) => {
  const env = environment(t);
  env.DB.sqlite.exec("INSERT INTO rate_limit_buckets VALUES ('expired', 1, 0)");
  await worker.scheduled({ cron: '0 0-21,23 * * *' }, env, {});
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM rate_limit_buckets').get().n, 0);
});
