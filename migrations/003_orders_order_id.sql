ALTER TABLE orders ADD COLUMN order_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
