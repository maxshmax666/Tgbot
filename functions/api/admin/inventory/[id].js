import { z } from "zod";
import { json, handleError, parseJsonBody, ensureOwner, idSchema } from "../../_utils.js";

const inventorySchema = z.object({
  qtyAvailable: z.number().min(0),
});

export async function onRequest({ env, request, params }) {
  try {
    await ensureOwner(request, env);
    const id = idSchema.parse(params.id);

    if (request.method === "PUT") {
      const body = await parseJsonBody(request, inventorySchema);
      await env.DB.prepare(
        `INSERT INTO inventory (ingredient_id, qty_available, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(ingredient_id) DO UPDATE SET qty_available = excluded.qty_available, updated_at = excluded.updated_at`
      )
        .bind(id, body.qtyAvailable)
        .run();
      return json({ ok: true });
    }

    return json({ error: { message: "Method not allowed" } }, 405);
  } catch (err) {
    return handleError(err);
  }
}
