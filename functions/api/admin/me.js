import { json, handleError, requireAuth } from "../_utils.js";

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
    return handleError(err);
  }
}
