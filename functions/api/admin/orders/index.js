import { json, handleError, ensureOwner } from "../../_utils.js";

export async function onRequestGet({ env, request }) {
  try {
    await ensureOwner(request, env);
    const result = await env.DB.prepare(
      "SELECT id, created_at, status, customer_name, phone, address, comment, items_json, total FROM orders ORDER BY created_at DESC, id DESC"
    ).all();
    const items = (result.results || []).map((order) => ({
      ...order,
      items: order.items_json ? JSON.parse(order.items_json) : [],
    }));
    return json({ items });
  } catch (err) {
    return handleError(err);
  }
}
