import { z } from "zod";
import { json, handleError, parseJsonBody } from "../_utils.js";

const orderSchema = z.object({
  customerName: z.string().min(1),
  phone: z.string().min(3),
  address: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      title: z.string().min(1),
      qty: z.number().int().positive(),
      price: z.number().nonnegative(),
    })
  ),
  total: z.number().nonnegative(),
});

export async function onRequestPost({ env, request }) {
  try {
    const body = await parseJsonBody(request, orderSchema);
    const result = await env.DB.prepare(
      `INSERT INTO orders (created_at, status, customer_name, phone, address, comment, items_json, total)
       VALUES (datetime('now'), 'new', ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        body.customerName,
        body.phone,
        body.address || null,
        body.comment || null,
        JSON.stringify(body.items),
        body.total
      )
      .run();

    return json({ id: result.meta.last_row_id, status: "new" }, 201);
  } catch (err) {
    return handleError(err);
  }
}
