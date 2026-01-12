import { json, handleError, requireAuth, ensureOwner } from "../../_utils.js";

export async function onRequestGet({ env, request }) {
  try {
    await ensureOwner(env);
    await requireAuth(request, env);
    const result = await env.DB.prepare(
      "SELECT id, key, url, created_at, meta_json FROM media ORDER BY created_at DESC, id DESC"
    ).all();
    const items = (result.results || []).map((row) => ({
      ...row,
      meta: row.meta_json ? JSON.parse(row.meta_json) : {},
    }));
    return json({ items });
  } catch (err) {
    return handleError(err);
  }
}
