import { z } from "zod";
import bcrypt from "bcryptjs";
import { json, handleError, parseJsonBody, requireDb, RequestError } from "../../../_utils.js";
import { consumeAuthToken } from "../../../_authTokens.js";

const confirmSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

async function resetPassword(db, token, password) {
  const record = await consumeAuthToken(db, { token, purpose: "reset_password" });
  if (!record) {
    throw new RequestError(400, "Неверный или просроченный токен");
  }
  const hash = await bcrypt.hash(password, 10);
  await db
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(hash, record.user_id)
    .run();
}

export async function onRequestPost({ env, request }) {
  try {
    const db = requireDb(env);
    const body = await parseJsonBody(request, confirmSchema);
    await resetPassword(db, body.token, body.password);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
