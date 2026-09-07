import assert from 'node:assert/strict';
import { test } from 'node:test';
import { environment, actor } from './support.mjs';
import upload from '../src/routes/upload.ts';
import media from '../src/routes/media.ts';
import safety from '../src/routes/safety.ts';
import players from '../src/routes/players.ts';
import news from '../src/routes/news.ts';
import events from '../src/routes/events.ts';
import { isMetadataFreeWebp, MAX_IMAGE_SIZE } from '../src/lib/media.ts';

// A synthetic container isolates our storage/review checks from the provider's codec.
// Real decoding, orientation and metadata removal require a staged Images binding test.
function webp(chunks = [['VP8 ', Buffer.from([1, 2])]]) {
  const content = Buffer.concat(chunks.map(([tag, bytes]) => {
    const header = Buffer.alloc(8); header.write(tag); header.writeUInt32LE(bytes.length, 4);
    return Buffer.concat([header, bytes, Buffer.alloc(bytes.length % 2)]);
  }));
  const header = Buffer.alloc(12); header.write('RIFF'); header.writeUInt32LE(content.length + 4, 4); header.write('WEBP', 8);
  return Buffer.concat([header, content]);
}
const processed = webp();
const original = Buffer.from('synthetic input with GPS and owner metadata');

function imageProcessor(options = {}) {
  return {
    info: async stream => {
      await new Response(stream).arrayBuffer();
      if (options.fail) throw new Error('Processor failed');
      return { format: options.format || 'image/jpeg', width: options.width || 400, height: 300, fileSize: original.length };
    },
    input: stream => ({
      transform: settings => {
        assert.equal(settings.fit, 'scale-down');
        return { output: async settings => {
          assert.equal(settings.format, 'image/webp'); assert.equal(settings.anim, false);
          await new Response(stream).arrayBuffer();
          return { response: () => new Response(options.output || processed, { headers: { 'Content-Type': options.outputType || 'image/webp' } }) };
        } };
      },
    }),
  };
}

async function setup(t) {
  const env = environment(t);
  const objects = new Map();
  env.UPLOADS = {
    put: async (key, buffer, metadata) => { objects.set(key, { bytes: Buffer.from(buffer), ...metadata }); },
    get: async key => { const object = objects.get(key); return object ? { ...object, body: new Response(object.bytes).body } : null; },
    head: async key => objects.get(key) || null,
    delete: async key => { objects.delete(key); },
  };
  env.IMAGES = imageProcessor();
  const admin = await actor(env, 'admin', 'admin');
  const parent = await actor(env, 'parent', 'parent');
  for (const id of ['child-one', 'child-two']) {
    env.DB.sqlite.prepare('INSERT INTO players (id, first_name, last_name, age_group) VALUES (?, ?, ?, ?)').run(id, id, 'PrivateSurname', 'U9');
    env.DB.sqlite.prepare('INSERT INTO player_consents (player_id, media_consent, public_profile_consent, stats_public_consent) VALUES (?, 1, 1, 1)').run(id);
  }
  const post = (options = {}, headers = admin) => {
    const data = new FormData();
    data.set('file', options.file || new Blob([original], { type: 'image/jpeg' }), 'private-child-name.jpg');
    if (options.category) data.set('category', options.category);
    if (options.playerIds) data.set('playerIds', JSON.stringify(options.playerIds));
    return upload.request('/', { method: 'POST', headers, body: data }, env);
  };
  const row = () => env.DB.sqlite.prepare('SELECT * FROM upload_records ORDER BY rowid DESC LIMIT 1').get();
  const preview = (record = row(), headers = admin) => media.request(`/preview?key=${encodeURIComponent(record.key)}`, { headers }, env);
  const read = (record = row()) => media.request(`/?key=${encodeURIComponent(record.key)}`, {}, env);
  const review = (changes = {}, record = row(), headers = admin) => safety.request('/uploads/review', {
    method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: record.key, status: 'approved', reviewVersion: record.review_version, expectedSha256: record.sha256,
      reviewNotes: 'Reviewed all visible subjects', containsChildren: false, playerIds: [], allChildrenIdentified: true, ...changes }),
  }, env);
  return { env, objects, admin, parent, post, row, preview, read, review };
}

test('all uploads wait for review and only processed bytes with anonymous filenames reach storage', async (t) => {
  const { env, objects, post, row, read } = await setup(t);
  for (const category of ['general', 'unknown-category', 'team']) {
    const response = await post({ category, playerIds: category === 'team' ? ['child-one', 'child-two'] : [] });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { url: null, status: 'pending_review' });
    const record = row();
    assert.match(record.key, /\.webp$/);
    assert.ok(!record.key.includes('private-child-name'));
    assert.deepEqual(objects.get(record.key).bytes, processed);
    assert.equal(record.byte_size, processed.length);
    assert.equal(record.mime_type, 'image/webp');
    assert.equal((await read()).status, 404);
  }
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM upload_records').get().n, 3);
});

test('invalid inputs, failed processing and metadata-bearing outputs never reach storage', async (t) => {
  const { env, objects, post } = await setup(t);
  delete env.IMAGES;
  assert.equal((await post()).status, 503);
  for (const options of [
    { fail: true }, { format: 'image/svg+xml' }, { format: 'image/png' }, { width: 1_000_000 },
    { outputType: 'image/jpeg' }, { output: Buffer.from('not an image') },
    { output: webp([['VP8 ', Buffer.from([1, 2])], ['EXIF', Buffer.from('GPS')]]) },
    { output: webp([['VP8 ', Buffer.from([1, 2])], ['XMP ', Buffer.from('owner')]]) },
    { output: webp([['ANIM', Buffer.from([1, 2])], ['VP8 ', Buffer.from([1, 2])]]) },
  ]) {
    env.IMAGES = imageProcessor(options);
    assert.equal((await post()).status, 422);
  }
  env.IMAGES = imageProcessor();
  assert.equal((await post({ file: new Blob(['<svg/>'], { type: 'image/svg+xml' }) })).status, 400);
  assert.equal((await post({ file: new Blob([Buffer.alloc(MAX_IMAGE_SIZE + 1)], { type: 'image/jpeg' }) })).status, 400);
  const data = new FormData(); data.set('file', 'not a file');
  const headers = await actor(env, 'another-admin', 'admin');
  assert.equal((await upload.request('/', { method: 'POST', headers, body: data }, env)).status, 400);
  assert.equal(objects.size, 0);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM upload_records').get().n, 0);
  assert.equal(isMetadataFreeWebp(Buffer.concat([processed, Buffer.from('trailing metadata')])), false);
});

test('upload requires consent for every linked player and respects the uploader team', async (t) => {
  const { env, objects, post } = await setup(t);
  const coach = await actor(env, 'coach', 'coach');
  env.DB.sqlite.exec("INSERT INTO teams (id, name, age_group, coach_id) VALUES ('own-team', 'Team', 'U9', 'coach'); UPDATE players SET team_id = 'own-team' WHERE id = 'child-one'");
  assert.equal((await post({ category: 'team' })).status, 400);
  assert.equal((await post({ category: 'team', playerIds: ['unknown'] })).status, 403);
  assert.equal((await post({ category: 'team', playerIds: ['child-one', 'child-two'] }, coach)).status, 403);
  env.DB.sqlite.exec("UPDATE player_consents SET media_consent = 0 WHERE player_id = 'child-two'");
  assert.equal((await post({ category: 'team', playerIds: ['child-one', 'child-two'] })).status, 403);
  assert.equal(objects.size, 0);
});

test('private previews require an administrator and a saved access event for the exact image', async (t) => {
  const { env, post, preview, parent, row, read } = await setup(t);
  await post({ category: 'team', playerIds: ['child-one'] });
  assert.equal((await preview(row(), {})).status, 401);
  assert.equal((await preview(row(), parent)).status, 403);
  env.DB.sqlite.exec("CREATE TRIGGER block_preview BEFORE INSERT ON child_access_log BEGIN SELECT RAISE(ABORT, 'Simulated logging failure'); END");
  const blocked = await preview();
  assert.equal(blocked.status, 503);
  assert.ok(!(await blocked.text()).includes(processed.toString()));
  env.DB.sqlite.exec('DROP TRIGGER block_preview');
  const response = await preview();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), processed);
  const access = env.DB.sqlite.prepare("SELECT * FROM child_access_log WHERE action = 'media_preview'").get();
  assert.equal(access.media_key, row().key); assert.equal(access.media_sha256, row().sha256);
  assert.deepEqual(JSON.parse(access.player_ids), ['child-one']);
  assert.equal((await read()).status, 404);
});

test('approval requires this reviewer to preview, identify all children and check every consent', async (t) => {
  const { env, post, preview, review, read, row } = await setup(t);
  await post({ playerIds: ['child-one'] });
  const childReview = { containsChildren: true, playerIds: ['child-one', 'child-two'] };
  assert.equal((await review(childReview)).status, 400);
  await preview();
  const peer = await actor(env, 'reviewer-two', 'admin');
  assert.equal((await review(childReview, row(), peer)).status, 400);
  assert.equal((await review()).status, 400, 'known children cannot be relabelled as no children');
  for (const invalid of [{ containsChildren: 'false' }, { allChildrenIdentified: 'true' }, { allChildrenIdentified: false }, { reviewNotes: 'short' }]) {
    assert.equal((await review({ ...childReview, ...invalid })).status, 400);
  }
  env.DB.sqlite.exec("UPDATE player_consents SET media_consent = 0 WHERE player_id = 'child-two'");
  assert.equal((await review(childReview)).status, 400);
  env.DB.sqlite.exec("UPDATE player_consents SET media_consent = 1 WHERE player_id = 'child-two'");
  assert.equal((await review(childReview)).status, 200);
  assert.deepEqual(JSON.parse(row().player_ids), ['child-one', 'child-two']);
  const response = await read();
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('withdrawing any child consent blocks an approved group photo on the next request', async (t) => {
  const { env, post, preview, review, read, admin } = await setup(t);
  await post({ playerIds: ['child-one', 'child-two'] }); await preview();
  assert.equal((await review({ containsChildren: true, playerIds: ['child-one', 'child-two'] })).status, 200);
  assert.equal((await read()).status, 200);
  const response = await players.request('/child-two', { method: 'PUT', headers: { ...admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaConsent: false }) }, env);
  assert.equal(response.status, 200);
  const consent = env.DB.sqlite.prepare("SELECT * FROM player_consents WHERE player_id = 'child-two'").get();
  assert.equal(consent.media_consent, 0); assert.equal(consent.public_profile_consent, 1); assert.equal(consent.stats_public_consent, 1);
  const hidden = await read(); assert.equal(hidden.status, 404); assert.equal(hidden.headers.get('Cache-Control'), 'no-store');
});

test('consent strings cannot grant permission or partially update a player', async (t) => {
  const { env, admin } = await setup(t);
  const request = (body, path = '/child-one') => players.request(path, { method: 'PUT', headers: { ...admin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, env);
  for (const value of ['false', 'true', 1, null]) {
    assert.equal((await request({ mediaConsent: value, firstName: 'Changed' })).status, 400);
  }
  assert.equal(env.DB.sqlite.prepare("SELECT first_name FROM players WHERE id = 'child-one'").get().first_name, 'child-one');
  assert.equal((await request({ mediaConsent: false })).status, 200);
  assert.equal((await request({ statsPublicConsent: false })).status, 200);
  const consent = env.DB.sqlite.prepare("SELECT * FROM player_consents WHERE player_id = 'child-one'").get();
  assert.equal(consent.media_consent, 0); assert.equal(consent.public_profile_consent, 1); assert.equal(consent.stats_public_consent, 0);
});

test('stale or simultaneous reviews cannot overwrite a newer review', async (t) => {
  const { post, preview, review, row } = await setup(t);
  await post(); await preview(); const before = row();
  assert.equal((await review({ expectedSha256: 'wrong-hash' })).status, 409);
  const results = await Promise.all([review({}, before), review({ reviewNotes: 'A competing review' }, before)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(row().review_version, 1);
  assert.equal((await review({ status: 'rejected' }, before)).status, 409);
});

test('rejection withdraws access even if storage removal fails, and removal can be retried', async (t) => {
  const { env, objects, post, preview, review, read, row } = await setup(t);
  await post(); await preview(); assert.equal((await review()).status, 200);
  env.UPLOADS.delete = async () => { throw new Error('Storage unavailable'); };
  const rejection = await review({ status: 'rejected' });
  assert.equal(rejection.status, 200); assert.equal((await rejection.json()).cleanupPending, true);
  assert.equal(objects.size, 1); assert.equal((await read()).status, 404);
  assert.equal((await review()).status, 409);
  env.UPLOADS.delete = async key => { objects.delete(key); };
  assert.equal((await review({ status: 'rejected' })).status, 200);
  assert.equal(row().storage_cleanup_pending, 0); assert.equal(objects.size, 0);
});

test('old originals and storage objects with mismatched hashes cannot be previewed or published', async (t) => {
  const { env, objects, post, preview, review, read, row } = await setup(t);
  await post(); await preview(); await review();
  objects.get(row().key).customMetadata.sha256 = 'changed';
  assert.equal((await read()).status, 404); assert.equal((await preview()).status, 404);
  env.DB.sqlite.exec("UPDATE upload_records SET processing_version = ''");
  assert.equal((await preview()).status, 409); assert.equal((await review()).status, 409); assert.equal((await read()).status, 404);
});

test('news and event image fields cannot bypass review with an external URL or a revoked photo', async (t) => {
  const { env, post, preview, review, row, admin } = await setup(t);
  await post({ playerIds: ['child-one'] }); await preview(); await review({ containsChildren: true, playerIds: ['child-one'] });
  const image = row().url;
  const request = (router, data) => router.request('/', { method: 'POST', headers: { ...admin, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }, env);
  for (const [router, data] of [[news, { title: 'Test news', content: 'Club update', published: true }], [events, { title: 'Test event', date: '2027-05-01', isPublic: true }]]) {
    assert.equal((await request(router, { ...data, image: 'https://unreviewed.example/child.jpg' })).status, 400);
    assert.equal((await request(router, { ...data, image })).status, 201);
    assert.equal((await (await router.request('/', {}, env)).json())[0].image, image);
  }
  env.DB.sqlite.exec("UPDATE player_consents SET media_consent = 0 WHERE player_id = 'child-one'");
  for (const router of [news, events]) assert.equal((await (await router.request('/', {}, env)).json())[0].image, '');
});

test('failed database recording removes the processed orphan and never returns an image URL', async (t) => {
  const { env, objects, post } = await setup(t);
  env.DB.sqlite.exec("CREATE TRIGGER block_upload BEFORE INSERT ON upload_records BEGIN SELECT RAISE(ABORT, 'Simulated database failure'); END");
  const response = await post(); assert.equal(response.status, 503);
  assert.equal(objects.size, 0);
  assert.equal((await response.json()).url, undefined);
});
