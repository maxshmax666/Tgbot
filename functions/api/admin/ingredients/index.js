import { z } from "zod";
import { json, handleError, parseJsonBody, ensureAdmin } from "../../_utils.js";

const ingredientSchema = z.object({
  title: z.string().min(1),
  unit: z.enum(["g"]).default("g"),
  isActive: z.boolean().default(true),
});

export async function onRequest({ env, request }) {
  try {
    await ensureAdmin(request, env);

    if (request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT id, title, unit, is_active, created_at, updated_at FROM ingredients ORDER BY title ASC"
      ).all();
      return json({ items: result.results || [] });
    }

    if (request.method === "POST") {
      const body = await parseJsonBody(request, ingredientSchema);
      const result = await env.DB.prepare(
        `INSERT INTO ingredients (title, unit, is_active, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`
      )
        .bind(body.title, body.unit, body.isActive ? 1 : 0)
        .run();
      return json({ id: result.meta.last_row_id }, 201);
    }

    return json({ error: { message: "Method not allowed" } }, 405);
  } catch (err) {
    return handleError(err);
  }
}
