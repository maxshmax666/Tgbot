import { json, handleError, requireAuth, RequestError, requireDb } from "../_utils.js";

export async function onRequestGet({ env, request }) {
  try {
    const payload = await requireAuth(request, env);
    const db = requireDb(env);
    const id = String(payload.sub || "").startsWith("user:") ? Number(payload.sub.split(":")[1]) : null;
    if (!id || Number.isNaN(id)) {
      throw new RequestError(401, "Unauthorized");
    }
    const user = await db
      .prepare("SELECT id, email, role FROM users WHERE id = ? AND role = 'owner' LIMIT 1")
      .bind(id)
      .first();
    if (!user) {
      throw new RequestError(401, "Unauthorized");
    }
    return json({ user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    if (err instanceof RequestError && err.status === 401) {
      return json({ user: null }, 401);
    }
    return handleError(err);
  }
}
