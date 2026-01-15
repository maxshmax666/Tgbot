import { z } from "zod";
import { json, handleError, parseJsonBody, requireDb } from "../../../_utils.js";
import { createAuthToken } from "../../../_authTokens.js";
import { sendEmail } from "../../../_email.js";
import { clearRateLimitEntry, enforceRateLimit, registerRateLimitFailure } from "../../../_rateLimit.js";

const requestSchema = z.object({
  email: z.string().email(),
});

const normalizeEmail = (value) => value.trim().toLowerCase();

export async function onRequestPost({ env, request }) {
  try {
    const db = requireDb(env);
    const body = await parseJsonBody(request, requestSchema);
    const email = normalizeEmail(body.email);

    const limiter = await enforceRateLimit({
      db,
      request,
      keyPrefix: `password_reset:${email}`,
      maxAttempts: 3,
      windowMs: 30 * 60 * 1000,
    });

    const user = await db
      .prepare("SELECT id, email_verified_at FROM users WHERE email = ? LIMIT 1")
      .bind(email)
      .first();

    if (!user || !user.email_verified_at) {
      await registerRateLimitFailure({
        db,
        key: limiter.key,
        existing: limiter.existing,
        now: limiter.now,
        windowSize: limiter.windowSize,
      });
      return json({ ok: true });
    }

    const { token } = await createAuthToken(db, {
      userId: user.id,
      purpose: "reset_password",
      sentTo: email,
      ttlMs: 60 * 60 * 1000,
    });
    const origin = env.PUBLIC_APP_URL || new URL(request.url).origin;
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
    await sendEmail(env, {
      to: email,
      subject: "Сброс пароля",
      html: `<p>Ссылка для сброса пароля (действительна 1 час):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      text: `Сброс пароля: ${resetUrl}`,
    });
    await clearRateLimitEntry({ db, key: limiter.key });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
