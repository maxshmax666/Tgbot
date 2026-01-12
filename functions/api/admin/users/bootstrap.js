import { json, handleError, ensureOwner } from "../../_utils.js";

export async function onRequestPost({ env }) {
  try {
    await ensureOwner(env);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
