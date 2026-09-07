import assert from 'node:assert/strict';
import { test } from 'node:test';
import { environment, actor } from './support.mjs';
import teams from '../src/routes/teams.ts';
import fixtures from '../src/routes/fixtures.ts';
import events from '../src/routes/events.ts';
import news from '../src/routes/news.ts';
import players from '../src/routes/players.ts';
import { mapsUrl } from '../../shared/maps.ts';

const link = 'https://maps.app.goo.gl/TestLocation123';
const embed = 'https://www.google.com/maps/embed?pb=!1m18!2m3';
const fixture = { homeTeamName: 'Yeppoon', awayTeamName: 'Visitors', ageGroup: 'U14', round: 1, date: '2027-05-02', time: '11:15', isHomeGame: true };
const send = (route, env, headers, path, method, body) => route.request(path, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, env);

test('map links accept Google shares and copied embeds, rejecting executable and unrelated URLs', () => {
  assert.equal(mapsUrl(link), link);
  assert.equal(mapsUrl(`<iframe src="${embed}" width="600"></iframe>`, true), embed);
  for (const value of ['javascript:alert(1)', 'data:text/html,x', 'https://www.google.com.evil.test/maps/place/x', 'https://evil.test/maps', 'https://google.com/url?q=https://evil.test', 'http://maps.app.goo.gl/x', 'https://user:pass@www.google.com/maps/place/x', 'https://www.google.com:444/maps/place/x']) assert.throws(() => mapsUrl(value));
  for (const value of [link, '<script>alert(1)</script>', 'https://evil.test/maps/embed?pb=x']) assert.throws(() => mapsUrl(value, true));
});

test('training and fixture destinations persist, appear publicly, preserve unrelated edits and can be cleared', async t => {
  const env = environment(t), admin = await actor(env, 'admin', 'admin');
  const created = await send(teams, env, admin, '/', 'POST', { name: 'U14', ageGroup: 'U14', trainingMapsUrl: link, trainingMapsEmbedUrl: embed });
  assert.equal(created.status, 201);
  const team = await created.json();
  assert.equal((await (await teams.request(`/${team.id}`, {}, env)).json()).trainingMapsUrl, link);
  assert.equal((await send(teams, env, admin, `/${team.id}`, 'PUT', { trainingTime: '17:00' })).status, 200);
  assert.equal((await (await teams.request('/', {}, env)).json())[0].trainingMapsEmbedUrl, embed);
  const f = await send(fixtures, env, admin, '/', 'POST', { ...fixture, teamId: team.id, mapsUrl: link, mapsEmbedUrl: embed });
  assert.equal(f.status, 201); const saved = await f.json();
  const updated = await send(fixtures, env, admin, `/${saved.id}`, 'PUT', { ...fixture, time: '12:00', mapsUrl: link, mapsEmbedUrl: embed });
  assert.equal(updated.status, 200); assert.equal((await updated.json()).isHomeGame, true);
  assert.equal((await (await fixtures.request('/', {}, env)).json())[0].mapsUrl, link);
  assert.equal((await send(fixtures, env, admin, `/${saved.id}`, 'PUT', { mapsUrl: '', mapsEmbedUrl: '' })).status, 200);
  assert.equal((await (await fixtures.request(`/${saved.id}`, {}, env)).json()).mapsUrl, '');
});

test('fixture form failures are useful and invalid destinations never mutate records', async t => {
  const env = environment(t), admin = await actor(env, 'admin', 'admin');
  const empty = await send(fixtures, env, admin, '/', 'POST', { ...fixture, awayTeamName: '' });
  assert.equal(empty.status, 400); assert.match((await empty.json()).error, /away team/);
  for (const values of [{ date: '2027-02-30' }, { round: 0 }, { mapsUrl: 'javascript:alert(1)' }, { mapsEmbedUrl: embed }]) assert.equal((await send(fixtures, env, admin, '/', 'POST', { ...fixture, ...values })).status, 400);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM fixtures').get().n, 0);
  const coach = await actor(env, 'coach', 'coach');
  assert.equal((await send(fixtures, env, coach, '/', 'POST', fixture)).status, 403);
  assert.equal((await send(fixtures, env, admin, '/', 'POST', { ...fixture, awayTeamName: 'TBC', date: '2026-09-27' })).status, 201);
});

test('admin calendar handles drafts, publication, maps, edits and removal without exposing drafts', async t => {
  const env = environment(t), admin = await actor(env, 'admin', 'admin'), parent = await actor(env, 'parent', 'parent');
  const created = await send(events, env, admin, '/', 'POST', { title: 'Club event', date: '2027-04-03', isPublic: false, mapsUrl: link });
  assert.equal(created.status, 201); const event = await created.json();
  assert.deepEqual(await (await events.request('/', {}, env)).json(), []);
  assert.equal((await events.request(`/${event.id}`, {}, env)).status, 404);
  assert.equal((await events.request('/all', { headers: parent }, env)).status, 403);
  assert.equal((await (await events.request('/all', { headers: admin }, env)).json()).length, 1);
  const published = await send(events, env, admin, `/${event.id}`, 'PUT', { isPublic: true });
  assert.equal(published.status, 200);
  assert.equal((await (await events.request('/', {}, env)).json())[0].mapsUrl, link);
  assert.equal((await events.request(`/${event.id}`, { method: 'DELETE', headers: admin }, env)).status, 200);
  assert.equal((await events.request(`/${event.id}`, {}, env)).status, 404);
  assert.equal((await send(events, env, admin, '/', 'POST', { title: '', date: 'wrong' })).status, 400);
});

test('a news draft becomes visible only after publishing, including featured articles', async t => {
  const env = environment(t), admin = await actor(env, 'admin', 'admin');
  const created = await send(news, env, admin, '/', 'POST', { title: 'Test', content: 'A club update', published: false, featured: true });
  assert.equal(created.status, 201); const article = await created.json();
  assert.deepEqual(await (await news.request('/?featured=true', {}, env)).json(), []);
  assert.equal((await send(news, env, admin, `/${article.id}`, 'PUT', { published: true })).status, 200);
  assert.equal((await (await news.request('/', {}, env)).json())[0].title, 'Test');
  assert.equal((await send(news, env, admin, `/${article.id}`, 'PUT', { published: false })).status, 200);
  assert.equal((await news.request(`/${article.id}`, {}, env)).status, 404);
});

test('manual player entry stays pending and creates no login, payment or consent; duplicate retry is rejected', async t => {
  const env = environment(t), admin = await actor(env, 'admin', 'admin'), parent = await actor(env, 'parent', 'parent');
  const details = { firstName: 'Synthetic', lastName: 'Player', dateOfBirth: '2014-03-05', ageGroup: 'U14', guardianName: 'Adult', guardianEmail: 'adult@example.test', guardianPhone: '0400000000' };
  assert.equal((await send(players, env, parent, '/', 'POST', details)).status, 403);
  const created = await send(players, env, admin, '/', 'POST', details); assert.equal(created.status, 201);
  assert.equal((await send(players, env, admin, '/', 'POST', details)).status, 409);
  const row = env.DB.sqlite.prepare('SELECT * FROM players').get();
  assert.equal(row.registration_status, 'pending'); assert.equal(row.user_id, null);
  for (const table of ['registrations', 'player_consents', 'parent_child_links']) assert.equal(env.DB.sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0);
  assert.equal((await send(players, env, admin, '/', 'POST', { ...details, firstName: '' })).status, 400);
});
