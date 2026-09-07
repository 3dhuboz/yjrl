import assert from 'node:assert/strict';
import { test } from 'node:test';
import { environment, actor } from './support.mjs';
import stock from '../src/routes/stock.ts';
import shop from '../src/routes/shop.ts';
const request = (route, env, headers, path, method = 'GET', body) => route.request(path, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env);
async function setup(t) {
  const env = environment(t), admin = await actor(env, 'admin', 'admin'), parent = await actor(env, 'parent', 'parent');
  const id = crypto.randomUUID(), product = { name: 'Test shirt', category: 'uniform', priceCents: 2500, options: ['Youth 10', "Women's 12"], published: true, available: true };
  await request(shop, env, admin, '/products/' + id, 'PUT', product);
  await request(shop, env, admin, '/settings', 'PUT', { ordersOpen: true, collectionEnabled: true, onlineEnabled: false, collectionDetails: 'Club collection details', policies: 'Test collection policy' });
  const count = (option, onHand, version = 0) => request(stock, env, admin, '/' + id, 'PUT', { option, onHand, version, lowStockAt: 2, note: 'Physical count' });
  const order = async () => (await request(shop, env, parent, '/orders', 'POST', { requestId: crypto.randomUUID(), paymentMethod: 'collection', name: 'Test parent', phone: '0400000000', acceptPolicies: true, expectedTotalCents: 7500, items: [{ productId: id, option: 'Youth 10', quantity: 2 }, { productId: id, option: "Women's 12", quantity: 1 }] })).json();
  const action = (orderId, action) => request(shop, env, admin, '/orders/' + orderId, 'PUT', { action });
  const rows = async () => (await (await request(stock, env, admin, '/')).json()).rows;
  return { env, admin, parent, id, product, count, order, action, rows };
}
test('stock is admin-only, starts uncounted and rejects invalid or stale counts', async t => {
  const { env, parent, count, rows } = await setup(t);
  assert.equal((await request(stock, env, {}, '/')).status, 401);
  assert.equal((await request(stock, env, parent, '/')).status, 403);
  assert.equal((await rows())[0].onHand, null);
  assert.equal((await count('Youth 10', -1)).status, 400);
  assert.equal((await count('Youth 10', 1.5)).status, 400);
  assert.equal((await count('Unknown', 5)).status, 404);
  assert.equal((await count('Youth 10', 8, 4)).status, 409);
  assert.equal((await count('Youth 10', 8)).status, 200);
  assert.equal((await count('Youth 10', 99)).status, 409);
  assert.equal((await count('Youth 10', 10, 1)).status, 200);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM shop_stock_history').get().n, 2);
});
test('collection deductions are atomic across sizes and cannot run twice or lose concurrent stocktakes', async t => {
  const { count, order, action, rows } = await setup(t);
  await count('Youth 10', 10); await count("Women's 12", 0);
  const receipt = await order();
  assert.equal((await rows()).find(row => row.option === 'Youth 10').awaiting, 2);
  assert.equal((await action(receipt.id, 'fulfilled')).status, 409);
  await action(receipt.id, 'collection_paid');
  assert.equal((await action(receipt.id, 'fulfilled')).status, 409);
  assert.equal((await rows()).find(row => row.option === 'Youth 10').onHand, 10);
  await count("Women's 12", 5, 1);
  assert.equal((await action(receipt.id, 'fulfilled')).status, 200);
  const saved = await rows(); assert.equal(saved.find(row => row.option === 'Youth 10').onHand, 8); assert.equal(saved.find(row => row.option === "Women's 12").onHand, 4); assert.equal(saved[0].awaiting, 0);
  assert.equal((await action(receipt.id, 'fulfilled')).status, 409);
  assert.equal((await count('Youth 10', 99, 1)).status, 409);
});
test('cancelled orders release the outstanding count without changing physical stock; removed sizes retain stock', async t => {
  const { env, admin, id, product, count, order, action, rows } = await setup(t);
  await count('Youth 10', 10); const receipt = await order(); await action(receipt.id, 'cancel');
  let saved = (await rows()).find(row => row.option === 'Youth 10'); assert.equal(saved.awaiting, 0); assert.equal(saved.onHand, 10);
  await request(shop, env, admin, '/products/' + id, 'PUT', { ...product, options: ["Women's 12"] });
  saved = (await rows()).find(row => row.option === 'Youth 10'); assert.equal(saved.listed, 0); assert.equal(saved.onHand, 10);
  await request(shop, env, admin, '/products/' + id, 'DELETE');
  saved = (await rows()).find(row => row.option === 'Youth 10'); assert.equal(saved.active, 0); assert.equal(saved.onHand, 10);
});
