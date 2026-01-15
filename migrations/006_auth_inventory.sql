ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN telegram TEXT;
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  sent_to TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_ingredients (
  product_id INTEGER NOT NULL,
  ingredient_id INTEGER NOT NULL,
  qty_grams REAL NOT NULL,
  PRIMARY KEY (product_id, ingredient_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

CREATE TABLE IF NOT EXISTS inventory (
  ingredient_id INTEGER PRIMARY KEY,
  qty_available REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);
