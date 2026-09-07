import assert from 'node:assert/strict';
import { test } from 'node:test';
import shop from '../src/routes/shop.ts';
import { environment, actor } from './support.mjs';

const send = (env, headers, path, method = 'GET', body) => shop.request(path, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env);
const config = { ordersOpen: true, collectionEnabled: true, onlineEnabled: true, collectionDetails: 'Collect from the synthetic club counter on Tuesday.', policies: 'Synthetic test ordering and collection policies.' };
async function setup(t, online = false) {
  const env = { ...environment(t), ENVIRONMENT: online ? 'review' : 'production', FRONTEND_URL: 'https://shop.example.test', ...(online ? { PAYPAL_CLIENT_ID: 'test', PAYPAL_CLIENT_SECRET: 'test', PAYPAL_MODE: 'sandbox' } : {}) };
  const admin = await actor(env, 'admin', 'admin'), parent = await actor(env, 'parent', 'parent'), other = await actor(env, 'other', 'parent');
  const id = crypto.randomUUID(), details = { name: 'Synthetic jersey', category: 'uniform', description: 'Test product', priceCents: 2500, options: ['Size 10 / Blue', 'Size 12 / Blue'], published: true, available: true, image: '' };
  assert.equal((await send(env, admin, '/settings', 'PUT', config)).status, 200);
  assert.equal((await send(env, admin, '/products/' + id, 'PUT', details)).status, 200);
  const basket = { requestId: crypto.randomUUID(), items: [{ productId: id, option: 'Size 10 / Blue', quantity: 2 }], expectedTotalCents: 5000, paymentMethod: online ? 'paypal' : 'collection', name: 'Synthetic Adult', phone: '0400000000', acceptPolicies: true };
  return { env, admin, parent, other, id, details, basket, post: changes => send(env, parent, '/orders', 'POST', { ...basket, ...changes }) };
}
test('shop starts closed; products, settings and order contact information are admin-only', async t => {
  const env = environment(t), parent = await actor(env, 'parent', 'parent');
  const page = await (await send(env, {}, '/')).json(); assert.equal(page.settings.ordersOpen, false); assert.deepEqual(page.products, []);
  assert.equal((await send(env, parent, '/settings', 'PUT', config)).status, 403);
  assert.equal((await send(env, parent, '/admin')).status, 403);
  assert.equal((await send(env, parent, '/orders', 'POST', { requestId: crypto.randomUUID(), paymentMethod: 'collection' })).status, 403);
});
test('products need confirmed prices before publication and cannot bypass reviewed photos', async t => {
  const { env, admin, parent, id, details } = await setup(t);
  assert.equal((await send(env, parent, '/products/' + id, 'PUT', details)).status, 403);
  for (const change of [{ priceCents: 0 }, { priceCents: 12.3 }, { priceCents: -1 }, { options: [] }, { options: [''] }, { image: 'https://external.example/photo.jpg' }]) assert.equal((await send(env, admin, '/products/' + id, 'PUT', { ...details, ...change })).status, 400);
  assert.equal((await send(env, admin, '/products/' + id, 'PUT', { ...details, published: false, priceCents: 0 })).status, 200);
  assert.deepEqual((await (await send(env, {}, '/')).json()).products, []);
  assert.equal((await send(env, admin, '/settings', 'PUT', { ...config, collectionDetails: '' })).status, 400);
});
test('collection orders use server prices, capture policy snapshots and reject stale or unavailable choices', async t => {
  const { env, admin, id, details, post } = await setup(t);
  for (const change of [{ expectedTotalCents: 1 }, { items: [{ productId: id, option: 'Unknown', quantity: 2 }] }, { items: [{ productId: id, option: details.options[0], quantity: -1 }] }, { acceptPolicies: false }]) assert.ok([400, 409].includes((await post(change)).status));
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM shop_orders').get().n, 0);
  const result = await post(); assert.equal(result.status, 201); const receipt = await result.json(); assert.equal(receipt.totalCents, 5000); assert.equal(receipt.paymentStatus, 'unpaid'); assert.equal(receipt.collectionDetails, config.collectionDetails);
  await send(env, admin, '/products/' + id, 'PUT', { ...details, name: 'Renamed', priceCents: 3000 });
  const row = env.DB.sqlite.prepare('SELECT * FROM shop_orders').get(); assert.equal(JSON.parse(row.items)[0].name, details.name); assert.equal(row.policies_snapshot, config.policies);
  assert.equal((await post({ requestId: crypto.randomUUID() })).status, 409);
  await send(env, admin, '/products/' + id, 'DELETE');
  assert.equal((await post({ requestId: crypto.randomUUID() })).status, 409);
});
test('simultaneous retry creates one order and receipts belong only to the ordering account', async t => {
  const { env, other, post } = await setup(t);
  const results = await Promise.all(Array.from({ length: 10 }, () => post()));
  const ids = await Promise.all(results.map(async result => (await result.json()).id)); assert.equal(new Set(ids).size, 1);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM shop_orders').get().n, 1);
  assert.equal((await send(env, other, '/orders/' + ids[0])).status, 404);
  assert.equal((await send(env, other, '/orders/' + ids[0] + '/pay', 'POST')).status, 404);
  assert.equal((await send(env, other, '/orders/' + ids[0] + '/capture', 'POST')).status, 404);
});
test('collection payment must be recorded before fulfilment; online payment cannot be marked paid by admin', async t => {
  const { env, admin, parent, post } = await setup(t);
  const receipt = await (await post()).json();
  assert.equal((await send(env, parent, '/orders/' + receipt.id, 'PUT', { action: 'collection_paid' })).status, 403);
  assert.equal((await send(env, admin, '/orders/' + receipt.id, 'PUT', { action: 'fulfilled' })).status, 409);
  assert.equal((await send(env, admin, '/orders/' + receipt.id, 'PUT', { action: 'collection_paid' })).status, 200);
  assert.equal((await send(env, admin, '/orders/' + receipt.id, 'PUT', { action: 'collection_paid' })).status, 409);
  assert.equal((await send(env, admin, '/orders/' + receipt.id, 'PUT', { action: 'fulfilled' })).status, 200);
  const second = await (await post({ requestId: crypto.randomUUID() })).json();
  assert.equal((await send(env, admin, '/orders/' + second.id, 'PUT', { action: 'cancel' })).status, 200);
});
function mockPaypal(t, overrides = {}) {
  let creates = 0, captures = 0;
  const response = { purchase_units: [{ payments: { captures: [{ id: 'SYNTHETIC-CAPTURE', status: overrides.status || 'COMPLETED', amount: { value: overrides.amount || '50.00', currency_code: overrides.currency || 'AUD' } }] } }] };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(String(url).startsWith('https://api-m.sandbox.paypal.com/'));
    if (url.endsWith('/token')) return Response.json({ access_token: 'synthetic' });
    if (url.endsWith('/capture')) { captures++; if (overrides.lostResponse) return new Response('ORDER_ALREADY_CAPTURED', { status: 422 }); if (overrides.fail) return new Response('{}', { status: 503 }); return Response.json(response); }
    if (url.endsWith('/orders')) { creates++; const body = JSON.parse(init.body); assert.equal(body.purchase_units[0].amount.value, '50.00'); assert.ok(init.headers['PayPal-Request-Id'].startsWith('shop-order-')); assert.ok(!JSON.stringify(body).includes('Synthetic Adult')); return Response.json({ id: 'SYNTHETIC-ORDER', links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=SYNTHETIC' }] }); }
    return Response.json(overrides.lostResponse ? response : { status: 'CREATED', links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=SYNTHETIC' }] });
  });
  return { creates: () => creates, captures: () => captures };
}
test('online checkout can resume and capture once, without duplicate orders or duplicate payment recording', async t => {
  const { env, parent, admin, post } = await setup(t, true), mock = mockPaypal(t);
  const receipt = await (await post()).json();
  assert.equal((await send(env, admin, '/orders/' + receipt.id, 'PUT', { action: 'collection_paid' })).status, 409);
  for (let i = 0; i < 2; i++) assert.equal((await send(env, parent, '/orders/' + receipt.id + '/pay', 'POST')).status, 200);
  assert.equal(mock.creates(), 1);
  for (let i = 0; i < 2; i++) { const res = await send(env, parent, '/orders/' + receipt.id + '/capture', 'POST'); assert.equal(res.status, 200); assert.equal((await res.json()).paymentStatus, 'paid'); }
  assert.equal(mock.captures(), 1);
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM audit_log WHERE action = 'shop_payment_confirmed'").get().n, 1);
});
for (const [label, values] of [['wrong amount', { amount: '1.00' }], ['wrong currency', { currency: 'USD' }], ['pending capture', { status: 'PENDING' }], ['provider failure', { fail: true }]]) test(`${label} cannot mark a shop order paid`, async t => {
  const { env, parent, post } = await setup(t, true); mockPaypal(t, values);
  const receipt = await (await post()).json();
  await send(env, parent, '/orders/' + receipt.id + '/pay', 'POST');
  assert.ok([409, 502].includes((await send(env, parent, '/orders/' + receipt.id + '/capture', 'POST')).status));
  assert.equal(env.DB.sqlite.prepare('SELECT payment_status FROM shop_orders').get().payment_status, 'unpaid');
});
test('a previously captured PayPal order can be reconciled after a lost response', async t => {
  const { env, parent, post } = await setup(t, true); mockPaypal(t, { lostResponse: true });
  const receipt = await (await post()).json(); await send(env, parent, '/orders/' + receipt.id + '/pay', 'POST');
  assert.equal((await send(env, parent, '/orders/' + receipt.id + '/capture', 'POST')).status, 200);
  assert.equal(env.DB.sqlite.prepare('SELECT payment_status FROM shop_orders').get().payment_status, 'paid');
});
test('production cannot offer unconfigured or sandbox online payment', async t => {
  const { env, post } = await setup(t); env.PAYPAL_CLIENT_ID = 'test'; env.PAYPAL_CLIENT_SECRET = 'test'; env.PAYPAL_MODE = 'sandbox';
  assert.equal((await (await send(env, {}, '/')).json()).settings.onlineReady, false);
  assert.equal((await post({ paymentMethod: 'paypal' })).status, 400);
});
