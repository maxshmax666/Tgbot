import { json, handleError, RequestError, requireDb } from "../../_utils.js";

export async function onRequestGet({ env, params, request }) {
  try {
    const db = requireDb(env);
    const orderId = params.order_id;
    const requestId = new URL(request.url).searchParams.get("request_id");

    if (!orderId && !requestId) {
      throw new RequestError(400, "order_id or request_id is required");
    }

    const query = orderId
      ? {
          sql: "SELECT order_id, status, COALESCE(updated_at, created_at) AS updated_at FROM orders WHERE order_id = ? LIMIT 1",
          value: orderId,
        }
      : {
          sql: "SELECT order_id, status, COALESCE(updated_at, created_at) AS updated_at FROM orders WHERE request_id = ? LIMIT 1",
          value: requestId,
        };

    const order = await db.prepare(query.sql).bind(query.value).first();

    if (!order) throw new RequestError(404, "Order not found");

    return json({ order_id: order.order_id, status: order.status, updated_at: order.updated_at });
  } catch (err) {
    return handleError(err);
  }
}
