import { RequestError } from "./_utils.js";

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 10 * 60 * 1000;

function resolveClientKey(request) {
  const ipHeader =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  const ip = ipHeader.split(",")[0].trim();
  const userAgent = request.headers.get("user-agent") || "";
  return userAgent ? `${ip}|${userAgent}` : ip;
}

async function loadRateLimit(db, key) {
  return db
    .prepare("SELECT failures, reset_at FROM login_rate_limits WHERE key = ?")
    .bind(key)
    .first();
}

async function saveRateLimit(db, key, failures, resetAt) {
  await db
    .prepare(
      "INSERT INTO login_rate_limits (key, failures, reset_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET failures = excluded.failures, reset_at = excluded.reset_at"
    )
    .bind(key, failures, resetAt)
    .run();
}

async function clearRateLimit(db, key) {
  await db.prepare("DELETE FROM login_rate_limits WHERE key = ?").bind(key).run();
}

export async function enforceRateLimit({ db, request, keyPrefix, maxAttempts, windowMs }) {
  const clientKey = resolveClientKey(request);
  const key = keyPrefix ? `${keyPrefix}:${clientKey}` : clientKey;
  const now = Date.now();
  const limit = await loadRateLimit(db, key);
  const max = maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const windowSize = windowMs ?? DEFAULT_WINDOW_MS;
  if (limit && limit.reset_at > now && limit.failures >= max) {
    const retryAfterSec = Math.max(1, Math.ceil((limit.reset_at - now) / 1000));
    throw new RequestError(429, "Too many attempts", { retryAfter: retryAfterSec });
  }
  return { key, existing: limit, now, max, windowSize };
}

export async function registerRateLimitFailure({ db, key, existing, now, windowSize }) {
  const resetAt = existing && existing.reset_at > now ? existing.reset_at : now + windowSize;
  const failures = existing && existing.reset_at > now ? existing.failures + 1 : 1;
  await saveRateLimit(db, key, failures, resetAt);
}

export async function clearRateLimitEntry({ db, key }) {
  await clearRateLimit(db, key);
}
