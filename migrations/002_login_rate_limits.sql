CREATE TABLE IF NOT EXISTS login_rate_limits (
  key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
