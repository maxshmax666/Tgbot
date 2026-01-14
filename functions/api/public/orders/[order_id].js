import { z } from "zod";
import { json, handleError, RequestError, requireDb } from "../../_utils.js";

const orderIdSchema = z.string().min(1);

export async function onRequestGet({ env, params }) {
  try {
    const db = requireDb(env);
    const orderId = orderIdSchema.parse(params.order_id);

    const order = await db
      .prepare("SELECT status, updated_at FROM orders WHERE order_id = ? LIMIT 1")
      .bind(orderId)
      .first();

    if (!order) {
      throw new RequestError(404, "Order not found");
    }

    return json({ order_id: orderId, status: order.status, updated_at: order.updated_at });
  } catch (err) {
    return handleError(err);
  }
}
