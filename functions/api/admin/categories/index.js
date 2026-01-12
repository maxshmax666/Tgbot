import { z } from "zod";
import { json, handleError, parseJsonBody, ensureOwner } from "../../_utils.js";

const categorySchema = z.object({
  title: z.string().min(1),
  sort: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

export async function onRequest({ env, request }) {
  try {
    await ensureOwner(request, env);
    if (request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT id, title, sort, is_active FROM categories ORDER BY sort ASC, id ASC"
      ).all();
      return json({ items: result.results || [] });
    }
    if (request.method === "POST") {
      const body = await parseJsonBody(request, categorySchema);
      const result = await env.DB.prepare(
        "INSERT INTO categories (title, sort, is_active) VALUES (?, ?, ?)"
      )
        .bind(body.title, body.sort, body.isActive ? 1 : 0)
        .run();
      return json({ id: result.meta.last_row_id }, 201);
    }
    return json({ error: { message: "Method not allowed" } }, 405);
  } catch (err) {
    return handleError(err);
  }
}
