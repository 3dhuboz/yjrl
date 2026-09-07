CREATE TABLE shop_stock (
  product_id TEXT NOT NULL REFERENCES shop_products(id), option TEXT NOT NULL,
  on_hand INTEGER NOT NULL CHECK(on_hand >= 0), low_stock_at INTEGER NOT NULL DEFAULT 2 CHECK(low_stock_at >= 0),
  version INTEGER NOT NULL DEFAULT 1, note TEXT NOT NULL DEFAULT '', updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(product_id, option)
);
CREATE TABLE shop_stock_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL, option TEXT NOT NULL,
  previous_count INTEGER, on_hand INTEGER NOT NULL, note TEXT NOT NULL, user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX shop_stock_history_product ON shop_stock_history(product_id, id);
ALTER TABLE shop_orders ADD COLUMN fulfilled_by TEXT;
CREATE TRIGGER shop_stock_count_created AFTER INSERT ON shop_stock BEGIN
  INSERT INTO shop_stock_history(product_id, option, previous_count, on_hand, note, user_id)
  VALUES(NEW.product_id, NEW.option, NULL, NEW.on_hand, NEW.note, NEW.updated_by);
END;
CREATE TRIGGER shop_stock_count_updated AFTER UPDATE ON shop_stock BEGIN
  INSERT INTO shop_stock_history(product_id, option, previous_count, on_hand, note, user_id)
  VALUES(NEW.product_id, NEW.option, OLD.on_hand, NEW.on_hand, NEW.note, NEW.updated_by);
END;
-- The order status transition and every size deduction are one atomic write.
-- A second collection attempt cannot deduct stock twice; an insufficient count rolls everything back.
CREATE TRIGGER shop_stock_collected BEFORE UPDATE OF status ON shop_orders
WHEN OLD.status = 'placed' AND NEW.status = 'fulfilled'
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.items) item JOIN shop_stock stock
    ON stock.product_id = json_extract(item.value, '$.productId') AND stock.option = json_extract(item.value, '$.option')
    WHERE stock.on_hand < json_extract(item.value, '$.quantity')
  ) THEN RAISE(ABORT, 'shop_stock_insufficient') END;
  UPDATE shop_stock SET on_hand = on_hand - (
    SELECT SUM(json_extract(item.value, '$.quantity')) FROM json_each(NEW.items) item
    WHERE json_extract(item.value, '$.productId') = product_id AND json_extract(item.value, '$.option') = option
  ), version = version + 1, updated_at = datetime('now'), updated_by = NEW.fulfilled_by,
  note = 'Collected order ' || NEW.id
  WHERE EXISTS (SELECT 1 FROM json_each(NEW.items) item
    WHERE json_extract(item.value, '$.productId') = product_id AND json_extract(item.value, '$.option') = option);
END;
