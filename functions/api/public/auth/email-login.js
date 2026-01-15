import { z } from "zod";
import bcrypt from "bcryptjs";
import { json, handleError, parseJsonBody, requireDb, RequestError, createToken } from "../../_utils.js";
import { clearRateLimitEntry, enforceRateLimit, registerRateLimitFailure } from "../../_rateLimit.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const normalizeEmail = (value) => value.trim().toLowerCase();

export async function onRequestPost({ env, request }) {
  try {
    const db = requireDb(env);
    const body = await parseJsonBody(request, loginSchema);
    const email = normalizeEmail(body.email);

    const limiter = await enforceRateLimit({
      db,
      request,
      keyPrefix: `email_login:${email}`,
      maxAttempts: 5,
      windowMs: 10 * 60 * 1000,
    });

    const user = await db
      .prepare("SELECT id, email, password_hash, role, email_verified_at FROM users WHERE email = ? LIMIT 1")
      .bind(email)
      .first();

    if (!user) {
      await registerRateLimitFailure({
        db,
        key: limiter.key,
        existing: limiter.existing,
        now: limiter.now,
        windowSize: limiter.windowSize,
      });
      throw new RequestError(401, "Неверный email или пароль");
    }

    if (!user.email_verified_at) {
      throw new RequestError(403, "Email не подтверждён");
    }

    const ok = await bcrypt.compare(body.password, user.password_hash);
    if (!ok) {
      await registerRateLimitFailure({
        db,
        key: limiter.key,
        existing: limiter.existing,
        now: limiter.now,
        windowSize: limiter.windowSize,
      });
      throw new RequestError(401, "Неверный email или пароль");
    }

    await clearRateLimitEntry({ db, key: limiter.key });
    await db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(user.id).run();
    const token = await createToken({ sub: `user:${user.id}`, role: user.role, email: user.email }, env);
    return json({ user: { id: user.id, email: user.email, role: user.role }, token });
  } catch (err) {
    return handleError(err);
  }
}
