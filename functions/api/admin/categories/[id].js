import { z } from "zod";
import { json, handleError, parseJsonBody, ensureOwner, idSchema } from "../../_utils.js";

const categorySchema = z.object({
  title: z.string().min(1),
  sort: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

export async function onRequest({ env, request, params }) {
  try {
    await ensureOwner(request, env);
    const id = idSchema.parse(params.id);

    if (request.method === "GET") {
      const item = await env.DB.prepare(
        "SELECT id, title, sort, is_active FROM categories WHERE id = ? LIMIT 1"
      )
        .bind(id)
        .first();
      return json({ item });
    }

    if (request.method === "PUT") {
      const body = await parseJsonBody(request, categorySchema);
      await env.DB.prepare(
        "UPDATE categories SET title = ?, sort = ?, is_active = ? WHERE id = ?"
      )
        .bind(body.title, body.sort, body.isActive ? 1 : 0, id)
        .run();
      return json({ ok: true });
    }

    if (request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    return json({ error: { message: "Method not allowed" } }, 405);
  } catch (err) {
    return handleError(err);
  }
}
