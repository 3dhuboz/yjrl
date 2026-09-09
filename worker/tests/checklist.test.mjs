import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, actor } from './support.mjs';
import checklist, { tokenHash } from '../src/routes/checklist.ts';
import media from '../src/routes/media.ts';
import app from '../src/index.ts';
const send = (env, headers, path, method = 'GET', body) => checklist.request(path, { method, headers: { ...headers, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }, env);
async function setup(t) {
  const env = environment(t), admin = await actor(env, 'admin', 'admin'), parent = await actor(env, 'parent', 'parent');
  const result = await send(env, admin, '/links', 'POST', { label: 'Nathan test' }); assert.equal(result.status, 201);
  const link = await result.json(), headers = { 'X-Checklist-Token': link.token };
  return { env, admin, parent, link, headers };
}
test('private checklist links are scoped, hashed, expiring and immediately revocable', async t => {
  const { env, admin, parent, link, headers } = await setup(t);
  assert.equal((await send(env, {}, '/')).status, 401);
  assert.equal((await send(env, parent, '/')).status, 403);
  const view = await (await send(env, headers, '/')).json(); assert.equal(view.canManage, false); assert.equal(view.sections.length, 8);
  assert.ok(!JSON.stringify(view).includes(link.token));
  const stored = env.DB.sqlite.prepare('SELECT * FROM checklist_links WHERE id = ?').get(link.id); assert.equal(stored.token_hash, await tokenHash(link.token)); assert.notEqual(stored.token_hash, link.token);
  for (const path of ['/links', '/photos/test/review']) assert.equal((await send(env, headers, path, path.includes('/review') ? 'POST' : 'GET')).status, 401);
  assert.equal((await app.fetch(new Request('https://api.test/api/yjrl/players', { headers }), env, {})).status, 401);
  const listed = await (await send(env, admin, '/links')).json(); assert.equal(listed[0].token_hash, undefined);
  env.DB.sqlite.prepare("UPDATE checklist_links SET expires_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(link.id);
  assert.equal((await send(env, headers, '/')).status, 403);
  env.DB.sqlite.prepare("UPDATE checklist_links SET expires_at = '2099-01-01T00:00:00.000Z' WHERE id = ?").run(link.id);
  await send(env, admin, `/links/${link.id}`, 'DELETE'); assert.equal((await send(env, headers, '/')).status, 403);
});
test('notes save across sessions, stale edits cannot overwrite and only admin can mark complete', async t => {
  const { env, admin, headers } = await setup(t);
  const save = (version, notes, status = 'gathering', as = headers) => send(env, as, '/items/season', 'PUT', { version, notes, status });
  assert.equal((await save(0, '', 'submitted')).status, 400);
  assert.equal((await save(0, 'Dates still coming')).status, 200);
  assert.equal((await save(0, 'Stale first edit')).status, 409);
  assert.equal((await save(1, 'Open in January', 'submitted')).status, 200);
  assert.equal((await save(1, 'Stale overwrite')).status, 409);
  assert.equal((await save(2, 'Open in January', 'complete')).status, 403);
  assert.equal((await save(2, 'Open in January', 'complete', admin)).status, 200);
  const row = (await (await send(env, headers, '/')).json()).sections[0]; assert.equal(row.notes, 'Open in January'); assert.equal(row.status, 'complete'); assert.equal(row.version, 3);
  assert.equal((await send(env, headers, '/items/made-up', 'PUT', { notes: 'x', version: 0, status: 'gathering' })).status, 404);
});
async function imageSetup(t) {
  const result = await setup(t), { env } = result;
  const output = Buffer.from('524946460e0000005745425056503820020000000102', 'hex');
  env.IMAGES = { info: async () => ({ format: 'image/png', width: 10, height: 10 }), input: () => ({ transform: () => ({ output: async () => ({ response: () => new Response(output, { headers: { 'Content-Type': 'image/webp' } }) }) }) }) };
  const objects = new Map(); env.UPLOADS = { put: async (key, bytes, data) => objects.set(key, { bytes, ...data }), get: async key => { const o = objects.get(key); return o ? { ...o, body: new Response(o.bytes).body } : null; }, delete: async key => objects.delete(key) };
  const upload = (permission = 'true', type = 'image/png') => { const form = new FormData(); form.set('file', new Blob(['synthetic input with private metadata'], { type }), 'personal-filename.png'); form.set('caption', 'Club photo for homepage'); form.set('permissionConfirmed', permission); return checklist.request('/items/photos/photos', { method: 'POST', headers: result.headers, body: form }, env); };
  return { ...result, objects, upload, output };
}
test('photos require permission, use processed private storage, and hand over to existing review without publishing', async t => {
  const { env, admin, headers, upload, objects, output } = await imageSetup(t);
  assert.equal((await upload('false')).status, 400); assert.equal((await upload('true', 'image/svg+xml')).status, 400);
  const response = await upload(); assert.equal(response.status, 201); const photo = await response.json();
  const record = env.DB.sqlite.prepare('SELECT * FROM checklist_photos WHERE id = ?').get(photo.id);
  assert.equal(objects.size, 1); assert.deepEqual(Buffer.from(objects.get(record.storage_key).bytes), output); assert.ok(!record.storage_key.includes('personal-filename'));
  assert.equal((await checklist.request(`/photos/${photo.id}`, {}, env)).status, 401);
  assert.equal((await checklist.request(`/photos/${photo.id}`, { headers }, env)).status, 200);
  assert.equal((await media.request(`/?key=${encodeURIComponent(record.storage_key)}`, {}, env)).status, 404);
  assert.equal((await send(env, headers, `/photos/${photo.id}/review`, 'POST')).status, 401);
  assert.equal((await send(env, admin, `/photos/${photo.id}/review`, 'POST')).status, 200);
  assert.equal((await send(env, admin, `/photos/${photo.id}/review`, 'POST')).status, 200);
  const mediaRow = env.DB.sqlite.prepare('SELECT * FROM upload_records').get(); assert.equal(mediaRow.status, 'pending_review'); assert.equal(mediaRow.contains_children, null);
  assert.equal((await media.request(`/?key=${encodeURIComponent(record.storage_key)}`, {}, env)).status, 404);
  assert.equal((await send(env, headers, `/photos/${photo.id}`, 'DELETE')).status, 200);
  assert.equal((await checklist.request(`/photos/${photo.id}`, { headers }, env)).status, 404);
  assert.equal(objects.size, 1, 'Library object is retained for review');
});
test('failed photo save cleans storage and checklist reads fail closed when access logging fails', async t => {
  const { env, headers, upload, objects } = await imageSetup(t);
  env.DB.sqlite.exec("CREATE TRIGGER fail_checklist_photo BEFORE INSERT ON checklist_photos BEGIN SELECT RAISE(ABORT, 'synthetic storage failure'); END;");
  assert.equal((await upload()).status, 503); assert.equal(objects.size, 0);
  env.DB.sqlite.exec("CREATE TRIGGER fail_checklist_log BEFORE INSERT ON checklist_history BEGIN SELECT RAISE(ABORT, 'synthetic log failure'); END;");
  assert.equal((await send(env, headers, '/')).status, 500);
});
