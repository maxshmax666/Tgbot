import { json, handleError, ensureOwner } from "../../_utils.js";

export async function onRequestPost({ env, request }) {
  try {
    await ensureOwner(request, env);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
