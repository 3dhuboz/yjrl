import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { approvedMediaUrl } from '../lib/media';
import { createOrder, captureOrder, resumeOrder } from '../lib/paypal';

const shop = new Hono<{ Bindings: Env; Variables: Variables }>();
type Row = Record<string, unknown>;
const flag = (value: unknown) => value === true || value === 1;
const text = (value: unknown, max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
function paypalReady(env: Env): env is Env & { PAYPAL_CLIENT_ID: string; PAYPAL_CLIENT_SECRET: string } {
  return !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.FRONTEND_URL
    && (env.ENVIRONMENT !== 'production' || env.PAYPAL_MODE === 'live'));
}
async function settings(env: Env) {
  const row = await env.DB.prepare('SELECT * FROM shop_settings WHERE id = 1').first();
  return { ordersOpen: flag(row?.orders_open), collectionEnabled: flag(row?.collection_enabled), onlineEnabled: flag(row?.online_enabled), collectionDetails: row?.collection_details || '', policies: row?.policies || '', onlineReady: paypalReady(env) };
}
async function product(env: Env, url: string, row: Row) {
  return { id: row.id, name: row.name, category: row.category, description: row.description, priceCents: row.price_cents, options: JSON.parse(String(row.options)), image: await approvedMediaUrl(env, url, row.image), available: flag(row.available), published: flag(row.published) };
}
function order(row: Row, admin = false) {
  return { id: row.id, items: JSON.parse(String(row.items)), totalCents: row.total_cents, paymentMethod: row.payment_method, paymentStatus: row.payment_status, status: row.status, createdAt: row.created_at, collectionDetails: row.collection_snapshot, policies: row.policies_snapshot,
    ...(admin ? { contactName: row.contact_name, contactEmail: row.contact_email, contactPhone: row.contact_phone } : {}) };
}
shop.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
shop.get('/', async c => {
  const rows = await c.env.DB.prepare('SELECT * FROM shop_products WHERE is_active = 1 AND published = 1 ORDER BY category, name').all();
  return c.json({ settings: await settings(c.env), products: await Promise.all((rows.results || []).map(row => product(c.env, c.req.url, row))) });
});
shop.get('/admin', authMiddleware, async c => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const rows = await c.env.DB.prepare('SELECT * FROM shop_products WHERE is_active = 1 ORDER BY category, name').all();
  const orders = await c.env.DB.prepare('SELECT * FROM shop_orders ORDER BY created_at DESC LIMIT 100').all();
  return c.json({ settings: await settings(c.env), products: await Promise.all((rows.results || []).map(row => product(c.env, c.req.url, row))), orders: (orders.results || []).map(row => order(row, true)) });
});
shop.put('/settings', authMiddleware, async c => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body || ['ordersOpen', 'collectionEnabled', 'onlineEnabled'].some(key => typeof body[key] !== 'boolean')) return c.json({ error: 'Choose the shop opening and payment options.' }, 400);
  const details = text(body.collectionDetails), policies = text(body.policies);
  if (body.ordersOpen && (details.length < 10 || policies.length < 10 || (!body.collectionEnabled && !(body.onlineEnabled && paypalReady(c.env))))) return c.json({ error: 'Add collection details and shop policies, and configure at least one payment option before opening orders.' }, 400);
  await c.env.DB.prepare('UPDATE shop_settings SET orders_open = ?, collection_enabled = ?, online_enabled = ?, collection_details = ?, policies = ? WHERE id = 1').bind(Number(body.ordersOpen), Number(body.collectionEnabled), Number(body.onlineEnabled), details, policies).run();
  await writeAudit(c.env, c.get('user'), 'shop_settings_updated', 'shop', 'settings', { ordersOpen: body.ordersOpen });
  return c.json(await settings(c.env));
});
// Product updates use a complete form so invalid prices/options never reach checkout.
shop.put('/products/:id', authMiddleware, async c => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body || !text(body.name, 150) || !['uniform', 'merchandise'].includes(body.category)
    || !Number.isInteger(body.priceCents) || body.priceCents < 0 || body.priceCents > 999999
    || !Array.isArray(body.options) || !body.options.length || body.options.length > 60 || body.options.some((value: unknown) => typeof value !== 'string' || !value.trim() || value.length > 100)
    || typeof body.published !== 'boolean' || typeof body.available !== 'boolean') return c.json({ error: 'Enter a product name, valid AUD price, category and size/colour options.' }, 400);
  if (body.published && body.priceCents < 1) return c.json({ error: 'Set a confirmed price before publishing this product.' }, 400);
  const image = await approvedMediaUrl(c.env, c.req.url, body.image);
  if (body.image && !image) return c.json({ error: 'Choose an approved product photo.' }, 400);
  const id = c.req.param('id') || '';
  if (!/^[a-f0-9-]{36}$/.test(id)) return c.json({ error: 'Invalid product reference.' }, 400);
  await c.env.DB.prepare(`INSERT INTO shop_products (id, name, category, description, price_cents, options, image, available, published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, description=excluded.description, price_cents=excluded.price_cents, options=excluded.options, image=excluded.image, available=excluded.available, published=excluded.published, is_active=1, updated_at=datetime('now')`)
    .bind(id, text(body.name, 150), body.category, text(body.description), body.priceCents, JSON.stringify([...new Set(body.options.map((value: string) => value.trim()))]), image, Number(body.available), Number(body.published)).run();
  await writeAudit(c.env, c.get('user'), 'shop_product_saved', 'shop_product', id, { published: body.published });
  return c.json(await product(c.env, c.req.url, (await c.env.DB.prepare('SELECT * FROM shop_products WHERE id = ?').bind(id).first())!));
});
shop.delete('/products/:id', authMiddleware, async c => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  await c.env.DB.prepare('UPDATE shop_products SET is_active = 0 WHERE id = ?').bind(c.req.param('id')).run();
  await writeAudit(c.env, c.get('user'), 'shop_product_removed', 'shop_product', c.req.param('id'));
  return c.json({ message: 'Product removed; existing order records retained.' });
});

shop.post('/orders', authMiddleware, async c => {
  const body = await c.req.json().catch(() => null), user = c.get('user');
  if (!body || !/^[a-f0-9-]{36}$/.test(body.requestId || '') || !['collection', 'paypal'].includes(body.paymentMethod)) return c.json({ error: 'Choose a payment option and try again.' }, 400);
  const existing = await c.env.DB.prepare('SELECT * FROM shop_orders WHERE user_id = ? AND request_id = ?').bind(user.id, body.requestId).first();
  if (existing) return c.json(order(existing));
  const config = await settings(c.env);
  if (!config.ordersOpen) return c.json({ error: 'Shop orders are not open yet.' }, 403);
  if ((body.paymentMethod === 'collection' && !config.collectionEnabled) || (body.paymentMethod === 'paypal' && (!config.onlineEnabled || !config.onlineReady))) return c.json({ error: 'This payment option is not available.' }, 400);
  const phone = text(body.phone, 40), name = text(body.name, 150);
  if (!name || !/^[+()\d\s.-]{7,40}$/.test(phone) || !/^\d{7,15}$/.test(phone.replace(/\D/g, '')) || body.acceptPolicies !== true) return c.json({ error: 'Enter your name and phone number and accept the shop policies.' }, 400);
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 20) return c.json({ error: 'Add between 1 and 20 items to your basket.' }, 400);
  const items = [], seen = new Set(); let total = 0;
  for (const item of body.items) {
    if (!item || typeof item.productId !== 'string' || typeof item.option !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) return c.json({ error: 'Choose valid product options and quantities (1–20).' }, 400);
    const key = JSON.stringify([item.productId, item.option]);
    if (seen.has(key)) return c.json({ error: 'Combine duplicate items in your basket.' }, 400); seen.add(key);
    const row = await c.env.DB.prepare('SELECT * FROM shop_products WHERE id = ? AND is_active = 1 AND published = 1 AND available = 1').bind(item.productId).first();
    if (!row || Number(row.price_cents) < 1 || !JSON.parse(String(row.options)).includes(item.option)) return c.json({ error: 'An item or size is no longer available. Refresh the shop and check your basket.' }, 409);
    const price = Number(row.price_cents); total += price * item.quantity;
    items.push({ productId: row.id, name: row.name, option: item.option, quantity: item.quantity, priceCents: price });
  }
  if (body.expectedTotalCents !== total) return c.json({ error: 'Prices have changed. Refresh the shop and confirm the new total before ordering.' }, 409);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO shop_orders (id, user_id, request_id, payment_method, total_cents, items, contact_name, contact_email, contact_phone, policies_snapshot, collection_snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, request_id) DO NOTHING`).bind(id, user.id, body.requestId, body.paymentMethod, total, JSON.stringify(items), name, user.email, phone, config.policies, config.collectionDetails).run();
  const saved = (await c.env.DB.prepare('SELECT * FROM shop_orders WHERE user_id = ? AND request_id = ?').bind(user.id, body.requestId).first())!;
  if (saved.id === id) await writeAudit(c.env, user, 'shop_order_created', 'shop_order', id, { totalCents: total, paymentMethod: body.paymentMethod });
  return c.json(order(saved), 201);
});
shop.get('/orders/:id', authMiddleware, async c => {
  const row = await c.env.DB.prepare('SELECT * FROM shop_orders WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).first();
  return row ? c.json(order(row)) : c.json({ error: 'Order not found.' }, 404);
});
shop.post('/orders/:id/pay', authMiddleware, async c => {
  const row = await c.env.DB.prepare('SELECT * FROM shop_orders WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).first();
  if (!row) return c.json({ error: 'Order not found.' }, 404);
  if (row.payment_status === 'paid') return c.json({ paid: true });
  if (row.payment_method !== 'paypal' || row.status !== 'placed') return c.json({ error: 'This order cannot be paid online.' }, 409);
  if (!paypalReady(c.env)) return c.json({ error: 'Online payment is temporarily unavailable. Your order is saved.' }, 503);
  try {
    if (row.paypal_order_id) return c.json(await resumeOrder(c.env, String(row.paypal_order_id)));
    const origin = new URL(c.env.FRONTEND_URL!).origin;
    const result = await createOrder(c.env, Number(row.total_cents) / 100, 'AUD', `Club shop order ${row.id}`, `${origin}/shop?order=${row.id}&payment=return`, `${origin}/shop?order=${row.id}&payment=cancelled`, `shop-order-${row.id}`);
    await c.env.DB.prepare('UPDATE shop_orders SET paypal_order_id = COALESCE(paypal_order_id, ?) WHERE id = ?').bind(result.orderId, row.id).run();
    return c.json({ approvalUrl: result.approvalUrl });
  } catch { return c.json({ error: 'Payment could not be started. Your order is saved; try again from this receipt.' }, 502); }
});
shop.post('/orders/:id/capture', authMiddleware, async c => {
  const row = await c.env.DB.prepare('SELECT * FROM shop_orders WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).first();
  if (!row) return c.json({ error: 'Order not found.' }, 404);
  if (row.payment_status === 'paid') return c.json(order(row));
  if (row.status !== 'placed' || row.payment_method !== 'paypal' || !row.paypal_order_id) return c.json({ error: 'This order has no online payment to confirm.' }, 409);
  if (!paypalReady(c.env)) return c.json({ error: 'Payment confirmation is temporarily unavailable. Keep your order reference.' }, 503);
  try {
    const result = await captureOrder(c.env, String(row.paypal_order_id), `shop-capture-${row.id}`);
    if (result.status !== 'COMPLETED' || !result.captureId || result.amount?.currency_code !== 'AUD' || result.amount?.value !== (Number(row.total_cents) / 100).toFixed(2)) return c.json({ error: 'Payment is not confirmed. Keep your reference and contact the club before retrying.' }, 409);
    const updated = await c.env.DB.prepare("UPDATE shop_orders SET payment_status = 'paid', capture_id = ?, updated_at = datetime('now') WHERE id = ? AND payment_status = 'unpaid' AND status = 'placed'").bind(result.captureId, row.id).run();
    if (updated.meta.changes) await writeAudit(c.env, c.get('user'), 'shop_payment_confirmed', 'shop_order', String(row.id), { captureId: result.captureId });
    return c.json(order((await c.env.DB.prepare('SELECT * FROM shop_orders WHERE id = ?').bind(row.id).first())!));
  } catch { return c.json({ error: 'Payment confirmation could not be completed. Keep this order reference and try again.' }, 502); }
});
shop.put('/orders/:id', authMiddleware, async c => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json().catch(() => null), id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT * FROM shop_orders WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Order not found.' }, 404);
  let condition: string, update: string;
  if (body?.action === 'collection_paid') { condition = "payment_method = 'collection' AND status = 'placed' AND payment_status = 'unpaid'"; update = "payment_status = 'paid'"; }
  else if (body?.action === 'fulfilled') { condition = "status = 'placed' AND payment_status = 'paid'"; update = "status = 'fulfilled'"; }
  else if (body?.action === 'cancel') { condition = "payment_method = 'collection' AND status = 'placed' AND payment_status = 'unpaid'"; update = "status = 'cancelled'"; }
  else return c.json({ error: 'Choose a valid order action.' }, 400);
  const result = await c.env.DB.prepare(`UPDATE shop_orders SET ${update}, updated_at = datetime('now') WHERE id = ? AND ${condition}`).bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'The order has changed or is not eligible for that action. Refresh the order list.' }, 409);
  await writeAudit(c.env, c.get('user'), 'shop_order_updated', 'shop_order', id, { action: body.action });
  return c.json(order((await c.env.DB.prepare('SELECT * FROM shop_orders WHERE id = ?').bind(id).first())!, true));
});
export default shop;
