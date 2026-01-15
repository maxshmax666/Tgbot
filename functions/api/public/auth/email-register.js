import { z } from "zod";
import bcrypt from "bcryptjs";
import { json, handleError, parseJsonBody, requireDb, RequestError } from "../../_utils.js";
import { createAuthToken } from "../../_authTokens.js";
import { sendEmail } from "../../_email.js";
import { clearRateLimitEntry, enforceRateLimit, registerRateLimitFailure } from "../../_rateLimit.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const normalizeEmail = (value) => value.trim().toLowerCase();

export async function onRequestPost({ env, request }) {
  try {
    const db = requireDb(env);
    const body = await parseJsonBody(request, registerSchema);
    const email = normalizeEmail(body.email);

    const limiter = await enforceRateLimit({
      db,
      request,
      keyPrefix: `email_register:${email}`,
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
    });

    const existing = await db.prepare("SELECT id, email_verified_at FROM users WHERE email = ?").bind(email).first();
    if (existing?.email_verified_at) {
      await registerRateLimitFailure({
        db,
        key: limiter.key,
        existing: limiter.existing,
        now: limiter.now,
        windowSize: limiter.windowSize,
      });
      throw new RequestError(409, "Пользователь уже существует");
    }

    const userId = existing?.id;
    if (!userId) {
      const passwordHash = await bcrypt.hash(body.password, 10);
      const result = await db
        .prepare(
          `INSERT INTO users (email, password_hash, role, created_at)
           VALUES (?, ?, 'customer', datetime('now'))`
        )
        .bind(email, passwordHash)
        .run();
      const createdId = result.meta.last_row_id;
      await clearRateLimitEntry({ db, key: limiter.key });
      const { token } = await createAuthToken(db, {
        userId: createdId,
        purpose: "verify_email",
        sentTo: email,
        ttlMs: 24 * 60 * 60 * 1000,
      });
      const origin = env.PUBLIC_APP_URL || new URL(request.url).origin;
      const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`;
      await sendEmail(env, {
        to: email,
        subject: "Подтверждение email",
        html: `<p>Подтвердите email, перейдя по ссылке:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
        text: `Подтвердите email: ${verifyUrl}`,
      });
      return json({ ok: true, requiresVerification: true });
    }

    const { token } = await createAuthToken(db, {
      userId,
      purpose: "verify_email",
      sentTo: email,
      ttlMs: 24 * 60 * 60 * 1000,
    });
    const origin = env.PUBLIC_APP_URL || new URL(request.url).origin;
    const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`;
    await sendEmail(env, {
      to: email,
      subject: "Подтверждение email",
      html: `<p>Подтвердите email, перейдя по ссылке:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
      text: `Подтвердите email: ${verifyUrl}`,
    });
    await clearRateLimitEntry({ db, key: limiter.key });
    return json({ ok: true, requiresVerification: true });
  } catch (err) {
    return handleError(err);
  }
}
