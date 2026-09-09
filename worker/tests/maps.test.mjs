import assert from 'node:assert/strict';
import { test } from 'node:test';
import { environment, actor } from './support.mjs';
import maps from '../src/routes/maps.ts';
import { googleMapsSearch, googlePlaceEmbed, mapsUrl } from '../../shared/maps.ts';

const send = (env, headers, query) => maps.request('/search', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) }, env);
test('map config never exposes the Places key and search requires admin', async t => {
  const env = environment(t); env.GOOGLE_PLACES_API_KEY = 'server-key-never-public'; env.GOOGLE_MAPS_EMBED_KEY = 'public-restricted-key';
  const config = await maps.request('/config', {}, env);
  assert.equal(config.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await config.json(), { searchAvailable: true, embedKey: 'public-restricted-key' });
  assert.equal((await send(env, {}, 'Oval')).status, 401);
  assert.equal((await send(env, await actor(env, 'parent', 'parent'), 'Oval')).status, 403);
});
test('venue search reports missing connection, invalid input, no results and provider failures accurately', async t => {
  const env = environment(t), admin = await actor(env, 'admin', 'admin');
  assert.equal((await send(env, admin, '')).status, 400);
  assert.equal((await send(env, admin, 'x'.repeat(201))).status, 400);
  assert.equal((await send(env, admin, 'Yeppoon oval')).status, 503);
  env.GOOGLE_PLACES_API_KEY = 'test-server-key';
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  assert.deepEqual(await (await send(env, admin, 'Yeppoon oval')).json(), { places: [] });
  mock.mock.mockImplementation(async () => new Response('secret provider error', { status: 403 }));
  const failure = await send(env, admin, 'Yeppoon oval'); assert.equal(failure.status, 502); assert.doesNotMatch(await failure.text(), /secret provider/);
});
test('Google results retain distinct IDs and attribution with minimal, bounded requests', async t => {
  const env = environment(t), admin = await actor(env, 'admin', 'admin'); env.GOOGLE_PLACES_API_KEY = 'test-server-key';
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://places.googleapis.com/v1/places:searchText');
    assert.equal(options.headers['X-Goog-Api-Key'], 'test-server-key');
    assert.equal(options.headers['X-Goog-FieldMask'], 'places.id,places.displayName,places.formattedAddress,places.attributions');
    assert.deepEqual(JSON.parse(options.body), { textQuery: 'Club & oval, Yeppoon', regionCode: 'AU', languageCode: 'en', pageSize: 6 });
    return Response.json({ places: [{ id: 'place_1', displayName: { text: 'Club' }, formattedAddress: 'Yeppoon', attributions: [{ provider: 'Source', providerUri: 'https://example.test/' }] }, { id: '<script>' }] });
  });
  const result = await (await send(env, admin, 'Club & oval, Yeppoon')).json();
  assert.equal(result.places.length, 1); assert.equal(result.places[0].id, 'place_1');
  assert.deepEqual(result.places[0].attributions, [{ name: 'Source', url: 'https://example.test/' }]);
});
test('selected Google place survives encoded labels and produces exact public destinations', () => {
  const link = googleMapsSearch('Club & oval, Yeppoon', 'place_1');
  assert.equal(mapsUrl(link), link); assert.equal(new URL(link).searchParams.get('query_place_id'), 'place_1');
  assert.equal(new URL(link).searchParams.get('query'), 'Club & oval, Yeppoon');
  const embed = googlePlaceEmbed(link, 'public-restricted-key'); assert.equal(new URL(embed).searchParams.get('q'), 'place_id:place_1');
  assert.equal(googlePlaceEmbed(link, ''), ''); assert.equal(googlePlaceEmbed('https://evil.test/?query_place_id=place_1', 'public-restricted-key'), '');
  assert.equal(googlePlaceEmbed(googleMapsSearch('Oval'), 'public-restricted-key'), '');
});
test('repeated admin searches are rate limited before calling Google', async t => {
  const env = environment(t), admin = await actor(env, 'admin', 'admin'); env.GOOGLE_PLACES_API_KEY = 'test-server-key';
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  for (let n = 0; n < 30; n++) assert.equal((await send(env, admin, 'Oval')).status, 200);
  assert.equal((await send(env, admin, 'Oval')).status, 429); assert.equal(mock.mock.callCount(), 30);
});
