import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  json,
  handleError,
  parseJsonBody,
  createToken,
  RequestError,
  createSessionCookie,
  requireDb,
} from "../../_utils.js";
import { clearRateLimitEntry, enforceRateLimit, registerRateLimitFailure } from "../../_rateLimit.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function onRequestPost({ env, request }) {
  try {
    const db = requireDb(env);
    const limiter = await enforceRateLimit({
      db,
      request,
      keyPrefix: "admin_login",
      maxAttempts: 5,
      windowMs: 10 * 60 * 1000,
    });

    const body = await parseJsonBody(request, loginSchema);
    const user = await db
      .prepare(
        "SELECT id, email, password_hash, role, email_verified_at FROM users WHERE email = ? LIMIT 1"
      )
      .bind(body.email)
      .first();

    if (!user || !["owner", "admin"].includes(user.role)) {
      await registerRateLimitFailure({ db, key: limiter.key, existing: limiter.existing, now: limiter.now, windowSize: limiter.windowSize });
      throw new RequestError(401, "Неверный email или пароль");
    }

    if (!user.email_verified_at) {
      throw new RequestError(403, "Email владельца не подтверждён");
    }

    const ok = await bcrypt.compare(body.password, user.password_hash);
    if (!ok) {
      await registerRateLimitFailure({ db, key: limiter.key, existing: limiter.existing, now: limiter.now, windowSize: limiter.windowSize });
      throw new RequestError(401, "Неверный email или пароль");
    }

    await clearRateLimitEntry({ db, key: limiter.key });
    await db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(user.id).run();
    const token = await createToken({ sub: `user:${user.id}`, role: user.role, email: user.email }, env);
    const sessionCookie = createSessionCookie(token, request);
    return json(
      { user: { id: user.id, email: user.email, role: user.role } },
      200,
      { "set-cookie": sessionCookie }
    );
  } catch (err) {
    return handleError(err);
  }
}
