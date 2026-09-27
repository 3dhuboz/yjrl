import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { stockWrite, validStockCount } from '../lib/stock';

const stock = new Hono<{ Bindings: Env; Variables: Variables }>();
stock.use('*', authMiddleware, async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  await next();
});
stock.get('/', async c => {
  const result = await c.env.DB.prepare(`WITH pending AS (
    SELECT json_extract(item.value, '$.productId') product_id, json_extract(item.value, '$.option') option,
      SUM(json_extract(item.value, '$.quantity')) awaiting,
      SUM(CASE WHEN orders.payment_status = 'paid' THEN json_extract(item.value, '$.quantity') ELSE 0 END) paid_awaiting
    FROM shop_orders orders, json_each(orders.items) item WHERE orders.status = 'placed' GROUP BY 1, 2
  ), variants AS (
    SELECT products.id product_id, sizes.value option FROM shop_products products, json_each(products.options) sizes WHERE products.is_active = 1
    UNION SELECT product_id, option FROM shop_stock
    UNION SELECT product_id, option FROM pending
  ) SELECT variants.product_id productId, variants.option, products.name, products.category,
    products.is_active active, EXISTS(SELECT 1 FROM json_each(products.options) WHERE value = variants.option) listed,
    stock.on_hand onHand, stock.low_stock_at lowStockAt, COALESCE(stock.version, 0) version,
    stock.updated_at updatedAt, COALESCE(pending.awaiting, 0) awaiting, COALESCE(pending.paid_awaiting, 0) paidAwaiting
    FROM variants JOIN shop_products products ON products.id = variants.product_id
    LEFT JOIN shop_stock stock USING(product_id, option) LEFT JOIN pending USING(product_id, option)
    ORDER BY products.name, variants.option`).all();
  return c.json({ rows: result.results || [] });
});
stock.put('/:productId', async c => {
  const body = await c.req.json().catch(() => null), productId = c.req.param('productId');
  if (!validStockCount(body)) return c.json({ error: 'Enter whole stock counts, a low-stock threshold and a short reason for the count.' }, 400);
  const known = await c.env.DB.prepare(`SELECT id FROM shop_products WHERE id = ? AND (
    EXISTS(SELECT 1 FROM json_each(options) WHERE value = ?) OR EXISTS(SELECT 1 FROM shop_stock WHERE product_id = ? AND option = ?)
    OR EXISTS(SELECT 1 FROM shop_orders orders, json_each(orders.items) item WHERE orders.status = 'placed' AND json_extract(item.value, '$.productId') = ? AND json_extract(item.value, '$.option') = ?))`).bind(productId, body.option, productId, body.option, productId, body.option).first();
  if (!known) return c.json({ error: 'Product or size not found. Refresh the stocktake page.' }, 404);
  try { await stockWrite(c.env, productId, body, c.get('user').id).run(); }
  catch (error) {
    if (String(error).includes('shop_stock_conflict')) return c.json({ error: 'Stock changed while this form was open. Close it, refresh the stocktake and check the count again.' }, 409);
    throw error;
  }
  return c.json({ message: 'Stock count saved.', version: body.version + 1 });
});
export default stock;
