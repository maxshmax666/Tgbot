ALTER TABLE orders ADD COLUMN updated_at TEXT;
ALTER TABLE orders ADD COLUMN request_id TEXT;
UPDATE orders SET updated_at = created_at WHERE updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at);
CREATE INDEX IF NOT EXISTS idx_orders_request_id ON orders(request_id);
