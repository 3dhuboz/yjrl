-- Outstanding orders hold stock until collected or cancelled. No time-based release
-- can free stock while a payment may still complete.
CREATE VIEW shop_stock_availability AS
SELECT stock.*, COALESCE((
  SELECT SUM(json_extract(item.value, '$.quantity'))
  FROM shop_orders orders, json_each(orders.items) item
  WHERE orders.status = 'placed' AND json_extract(item.value, '$.productId') = stock.product_id
    AND json_extract(item.value, '$.option') = stock.option
), 0) reserved FROM shop_stock stock;

CREATE TRIGGER shop_order_stock_check BEFORE INSERT ON shop_orders
WHEN NOT EXISTS (SELECT 1 FROM shop_orders WHERE user_id = NEW.user_id AND request_id = NEW.request_id)
AND EXISTS (
  SELECT 1 FROM json_each(NEW.items) item
  WHERE json_extract(item.value, '$.quantity') > COALESCE((
    SELECT on_hand - reserved FROM shop_stock_availability
    WHERE product_id = json_extract(item.value, '$.productId') AND option = json_extract(item.value, '$.option')
  ), 0)
  OR NOT EXISTS (
    SELECT 1 FROM shop_products products, json_each(products.options) sizes
    WHERE products.id = json_extract(item.value, '$.productId') AND sizes.value = json_extract(item.value, '$.option')
      AND products.is_active = 1 AND products.published = 1 AND products.available = 1
      AND products.price_cents = json_extract(item.value, '$.priceCents')
  )
)
BEGIN SELECT RAISE(ABORT, 'shop_stock_unavailable'); END;

-- Both the product editor and Stocktake supply the next expected version.
-- Raising abort lets a stale size roll back the whole product/count batch.
CREATE TRIGGER shop_stock_version_check BEFORE INSERT ON shop_stock
WHEN NEW.version != COALESCE((SELECT version + 1 FROM shop_stock WHERE product_id = NEW.product_id AND option = NEW.option), 1)
BEGIN SELECT RAISE(ABORT, 'shop_stock_conflict'); END;
