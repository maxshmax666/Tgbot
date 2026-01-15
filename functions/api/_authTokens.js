const textEncoder = new TextEncoder();

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");

const toBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export function generateToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return toBase64Url(buffer);
}

export async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(token));
  return toHex(digest);
}

export async function createAuthToken(db, { userId, purpose, sentTo, ttlMs }) {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const createdAt = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO auth_tokens (user_id, token_hash, purpose, sent_to, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(userId, tokenHash, purpose, sentTo, expiresAt, createdAt)
    .run();
  return { token, expiresAt };
}

export async function consumeAuthToken(db, { token, purpose }) {
  const tokenHash = await hashToken(token);
  const record = await db
    .prepare(
      `SELECT id, user_id, expires_at, used_at, purpose
       FROM auth_tokens
       WHERE token_hash = ?
       LIMIT 1`
    )
    .bind(tokenHash)
    .first();
  if (!record || record.purpose !== purpose) return null;
  if (record.used_at) return null;
  if (Date.parse(record.expires_at) < Date.now()) return null;
  await db
    .prepare("UPDATE auth_tokens SET used_at = datetime('now') WHERE id = ?")
    .bind(record.id)
    .run();
  return record;
}
