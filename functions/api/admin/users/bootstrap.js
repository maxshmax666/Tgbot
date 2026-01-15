import bcrypt from "bcryptjs";
import { json, handleError, requireDb, RequestError, requireEnv } from "../../_utils.js";

export async function onRequestPost({ env, request }) {
  try {
    const db = requireDb(env);
    const existing = await db
      .prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1")
      .first();
    if (existing) {
      return json({ ok: true, existed: true });
    }

    const secret = requireEnv(env.ADMIN_BOOTSTRAP_SECRET, "ADMIN_BOOTSTRAP_SECRET");
    const header = request.headers.get("x-bootstrap-secret") || "";
    if (!header || header !== secret) {
      throw new RequestError(401, "Bootstrap forbidden");
    }

    const email = requireEnv(env.ADMIN_OWNER_EMAIL, "ADMIN_OWNER_EMAIL");
    const phone = env.ADMIN_OWNER_PHONE || null;
    const telegram = env.ADMIN_OWNER_TG || null;
    const passwordHash = env.ADMIN_OWNER_PASSWORD_HASH;
    const passwordPlain = env.ADMIN_OWNER_PASSWORD;
    if (!passwordHash && !passwordPlain) {
      throw new RequestError(500, "ENV не настроены: ADMIN_OWNER_PASSWORD_HASH или ADMIN_OWNER_PASSWORD");
    }
    const hash = passwordHash || (await bcrypt.hash(passwordPlain, 10));

    await db
      .prepare(
        `INSERT INTO users (email, password_hash, role, phone, telegram, email_verified_at, created_at)
         VALUES (?, ?, 'owner', ?, ?, datetime('now'), datetime('now'))`
      )
      .bind(email, hash, phone, telegram)
      .run();

    return json({ ok: true, created: true });
  } catch (err) {
    return handleError(err);
  }
}
