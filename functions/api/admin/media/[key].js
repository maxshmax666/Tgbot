import { json, handleError, requireAuth, ensureOwner, RequestError } from "../../_utils.js";

export async function onRequestDelete({ env, request, params }) {
  try {
    await ensureOwner(env);
    await requireAuth(request, env);
    const key = params.key;
    const bucket = env.MEDIA_BUCKET;
    if (!bucket) throw new RequestError(500, "MEDIA_BUCKET binding is missing");
    await bucket.delete(key);
    await env.DB.prepare("DELETE FROM media WHERE key = ?").bind(key).run();
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
