import { json } from "./_utils.js";

export async function onRequestGet({ env }) {
  const missing = [];
  const hasDb = Boolean(env?.DB);
  const hasJwtSecret = Boolean(env?.JWT_SECRET);
  const hasAdminSecret = Boolean(env?.ADMIN_PASSWORD_HASH || env?.ADMIN_PASSWORD);

  if (!hasDb) missing.push("DB");
  if (!hasJwtSecret) missing.push("JWT_SECRET");
  if (!hasAdminSecret) missing.push("ADMIN_PASSWORD_HASH/ADMIN_PASSWORD");

  return json({
    ok: true,
    readiness: {
      db: hasDb,
      jwtSecret: hasJwtSecret,
      adminPassword: hasAdminSecret,
    },
    missing,
  });
}
