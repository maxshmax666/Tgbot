import { z } from "zod";
import bcrypt from "bcryptjs";
import { json, handleError, parseJsonBody, ensureOwner, createToken, RequestError } from "../../_utils.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function onRequestPost({ env, request }) {
  try {
    await ensureOwner(env);
    const body = await parseJsonBody(request, loginSchema);
    const user = await env.DB.prepare(
      "SELECT id, email, password_hash, role FROM users WHERE email = ? LIMIT 1"
    )
      .bind(body.email.toLowerCase())
      .first();

    if (!user) throw new RequestError(401, "Invalid credentials");
    const ok = await bcrypt.compare(body.password, user.password_hash);
    if (!ok) throw new RequestError(401, "Invalid credentials");

    const token = await createToken({ sub: String(user.id), role: user.role, email: user.email }, env);
    return json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    return handleError(err);
  }
}
