ALTER TABLE orders ADD COLUMN updated_at TEXT;
UPDATE orders SET updated_at = created_at WHERE updated_at IS NULL;
