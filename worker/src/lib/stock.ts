import type { Env } from '../types';

export type StockCount = { option: string; onHand: number; lowStockAt: number; version: number; note: string };
export function validStockCount(value: StockCount): boolean {
  return !!value && typeof value.option === 'string' && !!value.option.trim() && value.option.length <= 100
    && Number.isInteger(value.onHand) && value.onHand >= 0 && value.onHand <= 100000
    && Number.isInteger(value.lowStockAt) && value.lowStockAt >= 0 && value.lowStockAt <= 100000
    && Number.isInteger(value.version) && value.version >= 0
    && typeof value.note === 'string' && value.note.trim().length >= 3 && value.note.length <= 300;
}
export function stockWrite(env: Env, productId: string, count: StockCount, actorId: string) {
  return env.DB.prepare(`INSERT INTO shop_stock(product_id, option, on_hand, low_stock_at, version, note, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(product_id, option) DO UPDATE SET
    on_hand = excluded.on_hand, low_stock_at = excluded.low_stock_at, version = excluded.version,
    note = excluded.note, updated_by = excluded.updated_by, updated_at = datetime('now')`)
    .bind(productId, count.option, count.onHand, count.lowStockAt, count.version + 1, count.note.trim(), actorId);
}
