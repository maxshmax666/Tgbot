import { z } from "zod";
import { json, handleError, parseJsonBody, ensureOwner, idSchema } from "../../_utils.js";

const pageSchema = z.object({
  slug: z.string().min(1).max(80),
  title: z.string().min(1),
});

export async function onRequest({ env, request, params }) {
  try {
    await ensureOwner(request, env);
    const id = idSchema.parse(params.id);

    if (request.method === "GET") {
      const item = await env.DB.prepare(
        "SELECT id, slug, title, updated_at FROM pages WHERE id = ? LIMIT 1"
      )
        .bind(id)
        .first();
      return json({ item });
    }

    if (request.method === "PUT") {
      const body = await parseJsonBody(request, pageSchema);
      await env.DB.prepare(
        "UPDATE pages SET slug = ?, title = ?, updated_at = datetime('now') WHERE id = ?"
      )
        .bind(body.slug, body.title, id)
        .run();
      return json({ ok: true });
    }

    if (request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM page_blocks WHERE page_id = ?").bind(id).run();
      await env.DB.prepare("DELETE FROM pages WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    return json({ error: { message: "Method not allowed" } }, 405);
  } catch (err) {
    return handleError(err);
  }
}
