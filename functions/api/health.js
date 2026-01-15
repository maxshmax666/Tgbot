import { json } from "./_utils.js";

export async function onRequestGet({ env }) {
  const missing = [];
  const hasDb = Boolean(env?.DB);
  const hasJwtSecret = Boolean(env?.JWT_SECRET);
  const hasOwnerBootstrap = Boolean(
    env?.ADMIN_BOOTSTRAP_SECRET &&
      env?.ADMIN_OWNER_EMAIL &&
      (env?.ADMIN_OWNER_PASSWORD_HASH || env?.ADMIN_OWNER_PASSWORD)
  );

  if (!hasDb) missing.push("DB");
  if (!hasJwtSecret) missing.push("JWT_SECRET");
  if (!hasOwnerBootstrap) {
    missing.push("ADMIN_BOOTSTRAP_SECRET");
    missing.push("ADMIN_OWNER_EMAIL");
    missing.push("ADMIN_OWNER_PASSWORD_HASH/ADMIN_OWNER_PASSWORD");
  }

  return json({
    ok: true,
    readiness: {
      db: hasDb,
      jwtSecret: hasJwtSecret,
      adminBootstrap: hasOwnerBootstrap,
    },
    missing,
  });
}
