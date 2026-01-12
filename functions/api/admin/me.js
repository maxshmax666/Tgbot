import { json, handleError, requireAuth, ensureOwner } from "../_utils.js";

export async function onRequestGet({ env, request }) {
  try {
    await ensureOwner(env);
    const payload = await requireAuth(request, env);
    const user = await env.DB.prepare(
      "SELECT id, email, role, created_at FROM users WHERE id = ? LIMIT 1"
    )
      .bind(payload.sub)
      .first();
    if (!user) return json({ user: null }, 401);
    return json({ user });
  } catch (err) {
    return handleError(err);
  }
}
