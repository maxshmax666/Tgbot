import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  json,
  handleError,
  parseJsonBody,
  createToken,
  RequestError,
  createSessionCookie,
  requireEnv,
  requireDb,
} from "../../_utils.js";

const loginSchema = z.object({
  password: z.string().min(6),
});

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

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

export async function onRequestPost({ env, request }) {
  try {
    const db = requireDb(env);
    const rateKey = resolveClientKey(request);
    const now = Date.now();
    const existing = await loadRateLimit(db, rateKey);
    if (existing && existing.reset_at > now && existing.failures >= MAX_ATTEMPTS) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.reset_at - now) / 1000));
      console.warn("Admin login blocked", {
        key: rateKey,
        ip: rateKey.split("|")[0],
        retryAfterSec,
      });
      return json(
        { error: { message: "Too many login attempts", details: { retryAfter: retryAfterSec } } },
        429,
        { "retry-after": String(retryAfterSec) }
      );
    }

    const body = await parseJsonBody(request, loginSchema);
    const passwordHash = requireEnv(env.ADMIN_PASSWORD_HASH, "ADMIN_PASSWORD_HASH");
    const ok = await bcrypt.compare(body.password, passwordHash);
    if (!ok) {
      const resetAt = existing && existing.reset_at > now ? existing.reset_at : now + WINDOW_MS;
      const failures = existing && existing.reset_at > now ? existing.failures + 1 : 1;
      await saveRateLimit(db, rateKey, failures, resetAt);
      throw new RequestError(401, "Invalid credentials");
    }

    await clearRateLimit(db, rateKey);
    const token = await createToken({ sub: "admin", role: "owner", email: "admin" }, env);
    const sessionCookie = createSessionCookie(token, request);
    return json(
      { user: { id: "admin", email: "admin", role: "owner" } },
      200,
      { "set-cookie": sessionCookie }
    );
  } catch (err) {
    return handleError(err);
  }
}
