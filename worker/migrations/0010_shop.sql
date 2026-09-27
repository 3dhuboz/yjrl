CREATE TABLE shop_products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'uniform',
  description TEXT NOT NULL DEFAULT '', price_cents INTEGER NOT NULL DEFAULT 0,
  options TEXT NOT NULL DEFAULT '["One size"]', image TEXT NOT NULL DEFAULT '',
  available INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE shop_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1), orders_open INTEGER NOT NULL DEFAULT 0,
  collection_enabled INTEGER NOT NULL DEFAULT 1, online_enabled INTEGER NOT NULL DEFAULT 1,
  collection_details TEXT NOT NULL DEFAULT '', policies TEXT NOT NULL DEFAULT ''
);
INSERT INTO shop_settings (id) VALUES (1);
CREATE TABLE shop_orders (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('collection', 'paypal')),
  total_cents INTEGER NOT NULL, items TEXT NOT NULL,
  contact_name TEXT NOT NULL, contact_email TEXT NOT NULL, contact_phone TEXT NOT NULL,
  policies_snapshot TEXT NOT NULL DEFAULT '', collection_snapshot TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'placed' CHECK(status IN ('placed', 'fulfilled', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid')),
  paypal_order_id TEXT, capture_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, request_id)
);
CREATE INDEX shop_orders_user ON shop_orders(user_id, created_at);
