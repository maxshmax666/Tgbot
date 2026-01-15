import { json, handleError, ensureAdmin } from "../_utils.js";

export async function onRequestPost({ env, request }) {
  try {
    await ensureAdmin(request, env);
    return json(
      {
        ok: false,
        error: "UPLOAD_DISABLED",
        message: "R2 disabled. Use static assets paths like /assets/...",
      },
      501
    );
  } catch (err) {
    return handleError(err);
  }
}
