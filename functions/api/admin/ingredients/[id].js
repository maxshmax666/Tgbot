import { z } from "zod";
import { json, handleError, parseJsonBody, ensureOwner, idSchema } from "../../_utils.js";

const ingredientSchema = z.object({
  title: z.string().min(1),
  unit: z.enum(["g"]).default("g"),
  isActive: z.boolean().default(true),
});

export async function onRequest({ env, request, params }) {
  try {
    await ensureOwner(request, env);
    const id = idSchema.parse(params.id);

    if (request.method === "PUT") {
      const body = await parseJsonBody(request, ingredientSchema);
      await env.DB.prepare(
        `UPDATE ingredients
         SET title = ?, unit = ?, is_active = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(body.title, body.unit, body.isActive ? 1 : 0, id)
        .run();
      return json({ ok: true });
    }

    if (request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM product_ingredients WHERE ingredient_id = ?").bind(id).run();
      await env.DB.prepare("DELETE FROM inventory WHERE ingredient_id = ?").bind(id).run();
      await env.DB.prepare("DELETE FROM ingredients WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    return json({ error: { message: "Method not allowed" } }, 405);
  } catch (err) {
    return handleError(err);
  }
}
