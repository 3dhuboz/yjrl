import test from 'node:test';
import assert from 'node:assert/strict';
import chat from '../src/routes/chat.ts';
import { environment, actor } from './support.mjs';
import agreement from '../../shared/chatAgreement.json';
const send = (env, headers, path, method = 'GET', body) => chat.request(path, { method, headers: { ...headers, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }, env);
async function setup(t) {
  const env = environment(t);
  const admin = await actor(env, 'admin', 'admin'), coach = await actor(env, 'coach', 'coach'), parent = await actor(env, 'parent', 'parent'), outsider = await actor(env, 'other', 'parent'), junior = await actor(env, 'junior', 'player');
  env.DB.sqlite.exec("INSERT INTO teams(id, name, age_group, coach_id) VALUES ('team', 'U9 Seagulls', 'U9', 'coach'), ('other-team', 'U10 Seagulls', 'U10', NULL); INSERT INTO players(id, user_id, first_name, last_name, team_id) VALUES ('child', 'parent', 'PrivateChild', 'Name', 'team');");
  for (const headers of [admin, coach, parent, outsider]) assert.equal((await send(env, headers, '/agreement', 'POST', { accepted: true, version: agreement.version })).status, 200);
  return { env, admin, coach, parent, outsider, junior };
}
async function message(env, headers, extra = {}) {
  const result = await send(env, headers, '/', 'POST', { room_id: 'parent:team', message: 'Training at five', requestId: crypto.randomUUID(), ...extra });
  assert.equal(result.status, 201, await result.clone().text()); return result.json();
}

test('channels follow current adult team, coach and committee membership; removal revokes access', async t => {
  const { env, admin, coach, parent, outsider, junior } = await setup(t);
  assert.deepEqual((await (await send(env, parent, '/channels')).json()).map(r => r.id), ['parent:team']);
  assert.deepEqual((await (await send(env, outsider, '/channels')).json()), []);
  assert.equal((await send(env, junior, '/channels')).status, 403);
  for (const path of ['/?room_id=coaches:team', '/?room_id=committee-all', '/?room_id=parent:other-team', '/committee']) assert.equal((await send(env, parent, path)).status, 403, path);
  assert.equal((await send(env, admin, '/?room_id=made-up')).status, 403);
  assert.equal((await send(env, coach, '/?room_id=coaches:team')).status, 200);
  env.DB.sqlite.exec("UPDATE adult_role_approvals SET status = 'suspended' WHERE user_id = 'coach'");
  assert.equal((await send(env, coach, '/?room_id=coaches:team')).status, 403);
  assert.equal((await send(env, parent, '/committee/other', 'PUT', { member: true })).status, 403);
  assert.equal((await send(env, admin, '/committee/junior', 'PUT', { member: true })).status, 400);
  assert.equal((await send(env, admin, '/committee/other', 'PUT', { member: true })).status, 200);
  assert.equal((await send(env, outsider, '/?room_id=committee-all')).status, 200);
  await send(env, admin, '/committee/other', 'PUT', { member: false });
  assert.equal((await send(env, outsider, '/?room_id=committee-all')).status, 403);
  env.DB.sqlite.exec("UPDATE players SET is_active = 0 WHERE id = 'child'");
  assert.equal((await send(env, parent, '/?room_id=parent:team')).status, 403);
});

test('saved reactions are per adult and idempotent, unread/read positions cannot cross rooms or move backwards', async t => {
  const { env, coach, parent, outsider } = await setup(t);
  const first = await message(env, coach);
  const second = await message(env, coach);
  assert.equal((await (await send(env, parent, '/channels')).json())[0].unread, 2);
  for (let i = 0; i < 2; i++) assert.equal((await send(env, parent, `/${first.id}/reaction`, 'PUT', { emoji: '👍', active: true })).status, 200);
  assert.equal((await send(env, outsider, `/${first.id}/reaction`, 'PUT', { emoji: '👍', active: true })).status, 403);
  assert.equal((await send(env, parent, '/read', 'PUT', { roomId: 'parent:other-team', messageId: first.id })).status, 403);
  assert.equal((await send(env, coach, '/read', 'PUT', { roomId: 'coach-all', messageId: first.id })).status, 404);
  await send(env, parent, '/read', 'PUT', { roomId: 'parent:team', messageId: second.id });
  await send(env, parent, '/read', 'PUT', { roomId: 'parent:team', messageId: first.id });
  assert.equal((await (await send(env, parent, '/channels')).json())[0].unread, 0);
  const rows = (await (await send(env, parent, '/?room_id=parent:team')).json()).messages;
  assert.deepEqual(rows[0].reactions, { '👍': 1 }); assert.deepEqual(rows[0].myReactions, ['👍']); assert.equal(rows[1].seenCount, 1);
  await send(env, parent, `/${first.id}/reaction`, 'PUT', { emoji: '👍', active: false });
  assert.deepEqual((await (await send(env, parent, '/?room_id=parent:team')).json()).messages[0].reactions, {});
});

test('organisers announce and pin; retry creates only one message, pagination and reporting remain available', async t => {
  const { env, coach, parent } = await setup(t);
  assert.equal((await send(env, parent, '/', 'POST', { room_id: 'parent:team', message: 'Update', kind: 'announcement' })).status, 403);
  const requestId = crypto.randomUUID();
  const a = await message(env, coach, { requestId, kind: 'announcement' });
  const b = await message(env, coach, { requestId, kind: 'announcement' }); assert.equal(a.id, b.id);
  assert.equal((await send(env, parent, `/${a.id}/pin`, 'PUT', { pinned: true })).status, 403);
  assert.equal((await send(env, coach, `/${a.id}/pin`, 'PUT', { pinned: true })).status, 200);
  const next = await message(env, parent);
  const page = await (await send(env, parent, `/?room_id=parent:team&limit=1&before=${next.id}`)).json();
  assert.equal(page.messages[0].id, a.id); assert.equal(page.pinned[0].id, a.id);
  const report = await send(env, parent, `/${a.id}/report`, 'POST', { reason: 'Synthetic concern' }); assert.equal(report.status, 201);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS total FROM chat_messages').get().total, 2);
});

test('private schedules support edits, family RSVPs, organiser-only names and cancellation', async t => {
  const { env, coach, parent, outsider } = await setup(t);
  const fields = { roomId: 'parent:team', title: 'Practice', kind: 'training', startsAt: '2027-04-03T17:00:00+10:00', venue: 'Oval', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Oval', details: 'Bring water' };
  assert.equal((await send(env, parent, '/activities', 'POST', fields)).status, 403);
  assert.equal((await send(env, coach, '/activities', 'POST', { ...fields, mapsUrl: 'javascript:alert(1)' })).status, 400);
  const created = await send(env, coach, '/activities', 'POST', fields); assert.equal(created.status, 201); const { id } = await created.json();
  assert.equal((await send(env, outsider, '/activities?room_id=parent:team')).status, 403);
  assert.equal((await send(env, outsider, `/activities/${id}/attendance`, 'PUT', { status: 'going' })).status, 403);
  await send(env, parent, `/activities/${id}/attendance`, 'PUT', { status: 'going' });
  await send(env, parent, `/activities/${id}/attendance`, 'PUT', { status: 'maybe' });
  const publicToGroup = (await (await send(env, parent, '/activities?room_id=parent:team')).json())[0];
  assert.equal(publicToGroup.my_status, 'maybe'); assert.deepEqual(publicToGroup.counts, { going: 0, maybe: 1, unavailable: 0 }); assert.equal(publicToGroup.replies, undefined); assert.equal(publicToGroup.starts_at, '2027-04-03T07:00:00.000Z');
  assert.equal((await (await send(env, coach, '/activities?room_id=parent:team')).json())[0].replies.length, 1);
  assert.equal((await send(env, parent, `/activities/${id}`, 'PUT', { ...fields, cancelled: true })).status, 403);
  assert.equal((await send(env, coach, `/activities/${id}`, 'PUT', { ...fields, cancelled: true })).status, 200);
  assert.equal((await send(env, parent, `/activities/${id}/attendance`, 'PUT', { status: 'going' })).status, 409);
});

test('adult agreement is explicit, versioned and enforced server-side; reporting remains accessible without agreement', async t => {
  const { env, parent, coach } = await setup(t);
  const fresh = await actor(env, 'fresh', 'parent');
  env.DB.sqlite.exec("INSERT INTO players(id, user_id, first_name, last_name, team_id) VALUES ('fresh-child', 'fresh', 'Private', 'Child', 'team')");
  const m = await message(env, coach);
  const blocked = await send(env, fresh, '/', 'POST', { room_id: 'parent:team', message: 'Hello' });
  assert.equal(blocked.status, 403); assert.equal((await blocked.json()).code, 'chat_agreement_required');
  assert.equal((await send(env, fresh, `/${m.id}/reaction`, 'PUT', { emoji: '👍', active: true })).status, 403);
  for (const body of [{ accepted: false, version: agreement.version }, { accepted: 'true', version: agreement.version }, { accepted: true, version: 'old' }]) assert.equal((await send(env, fresh, '/agreement', 'POST', body)).status, 400);
  assert.equal((await send(env, fresh, `/${m.id}/report`, 'POST', { reason: 'Account may have been used by someone else' })).status, 201);
  assert.equal((await send(env, fresh, '/agreement', 'POST', { accepted: true, version: agreement.version })).status, 200);
  await message(env, fresh);
  const stored = env.DB.sqlite.prepare('SELECT * FROM chat_agreements WHERE user_id = ?').get('fresh');
  assert.deepEqual(JSON.parse(stored.agreement_json), agreement); assert.ok(stored.accepted_at);
  assert.throws(() => env.DB.sqlite.exec("UPDATE chat_agreements SET version = 'other'"), /immutable/);
  assert.equal((await (await send(env, parent, '/agreement')).json()).version, agreement.version);
});

test('announcements remain findable beyond recent chat and page sizes stay integral and within D1 limits', async t => {
  const { env, coach, parent } = await setup(t);
  const notice = await message(env, coach, { kind: 'announcement' });
  const insert = env.DB.sqlite.prepare("INSERT INTO chat_messages(room_id, user_id, user_name, message) VALUES ('parent:team', 'coach', 'Coach', ?)");
  for (let i = 0; i < 105; i++) insert.run(`Routine message ${i}`);
  const feed = await (await send(env, parent, '/?room_id=parent:team&limit=500')).json(); assert.equal(feed.messages.length, 80);
  const updates = await (await send(env, parent, '/?room_id=parent:team&kind=announcement')).json(); assert.equal(updates.messages[0].id, notice.id);
  assert.equal((await (await send(env, parent, '/?room_id=parent:team&limit=1.5')).json()).messages.length, 1);
});
