import { z } from "zod";
import { json, handleError, parseJsonBody, ensureOwner, idSchema } from "../../_utils.js";

const blockSchema = z.object({
  sort: z.number().int().nonnegative().default(0),
  type: z.string().min(1),
  props: z.record(z.any()).default({}),
});

export async function onRequest({ env, request, params }) {
  try {
    await ensureOwner(request, env);
    const id = idSchema.parse(params.id);

    if (request.method === "PUT") {
      const body = await parseJsonBody(request, blockSchema);
      await env.DB.prepare(
        "UPDATE page_blocks SET sort = ?, type = ?, props_json = ?, updated_at = datetime('now') WHERE id = ?"
      )
        .bind(body.sort, body.type, JSON.stringify(body.props), id)
        .run();
      return json({ ok: true });
    }

    if (request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM page_blocks WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    return json({ error: { message: "Method not allowed" } }, 405);
  } catch (err) {
    return handleError(err);
  }
}
