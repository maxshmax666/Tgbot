import { json, handleError, requireAuth, RequestError } from "../_utils.js";

export async function onRequestGet({ env, request }) {
  try {
    const payload = await requireAuth(request, env);
    return json({
      user: {
        id: payload.sub,
        email: payload.email || "admin",
        role: payload.role || "owner",
      },
    });
  } catch (err) {
    if (err instanceof RequestError && err.status === 401) {
      return json({ user: null }, 401);
    }
    return handleError(err);
  }
}
