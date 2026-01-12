import { z } from "zod";
import { json, handleError, parseJsonBody, ensureOwner, idSchema } from "../../_utils.js";

const statusSchema = z.object({
  status: z.string().min(1),
});

export async function onRequest({ env, request, params }) {
  try {
    await ensureOwner(request, env);
    const id = idSchema.parse(params.id);

    if (request.method === "GET") {
      const order = await env.DB.prepare(
        "SELECT id, created_at, status, customer_name, phone, address, comment, items_json, total FROM orders WHERE id = ? LIMIT 1"
      )
        .bind(id)
        .first();
      if (!order) return json({ item: null }, 404);
      return json({ item: { ...order, items: order.items_json ? JSON.parse(order.items_json) : [] } });
    }

    if (request.method === "PATCH") {
      const body = await parseJsonBody(request, statusSchema);
      await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?")
        .bind(body.status, id)
        .run();
      return json({ ok: true });
    }

    return json({ error: { message: "Method not allowed" } }, 405);
  } catch (err) {
    return handleError(err);
  }
}
