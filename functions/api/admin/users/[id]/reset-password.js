import { z } from "zod";
import bcrypt from "bcryptjs";
import { json, handleError, parseJsonBody, ensureOwner, idSchema } from "../../../_utils.js";

const resetSchema = z.object({
  password: z.string().min(8),
});

export async function onRequestPost({ env, request, params }) {
  try {
    await ensureOwner(request, env);
    const id = idSchema.parse(params.id);
    const body = await parseJsonBody(request, resetSchema);
    const hash = await bcrypt.hash(body.password, 10);
    await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(hash, id).run();
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
