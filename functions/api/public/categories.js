import { json, handleError } from "../_utils.js";

export async function onRequestGet({ env }) {
  try {
    const result = await env.DB.prepare(
      "SELECT id, title, sort, is_active FROM categories WHERE is_active = 1 ORDER BY sort ASC, id ASC"
    ).all();
    return json({ items: result.results || [] });
  } catch (err) {
    return handleError(err);
  }
}
