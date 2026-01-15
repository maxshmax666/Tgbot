import { z } from "zod";
import { json, handleError, parseJsonBody, requireDb, RequestError } from "../../_utils.js";
import { consumeAuthToken } from "../../_authTokens.js";

const tokenSchema = z.object({
  token: z.string().min(10),
});

async function verifyToken(db, token) {
  const record = await consumeAuthToken(db, { token, purpose: "verify_email" });
  if (!record) {
    throw new RequestError(400, "Неверный или просроченный токен");
  }
  await db
    .prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?")
    .bind(record.user_id)
    .run();
  return record;
}

export async function onRequestGet({ env, request }) {
  try {
    const db = requireDb(env);
    const token = new URL(request.url).searchParams.get("token") || "";
    await verifyToken(db, token);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const db = requireDb(env);
    const body = await parseJsonBody(request, tokenSchema);
    await verifyToken(db, body.token);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
