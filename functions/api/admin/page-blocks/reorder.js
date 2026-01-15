import { z } from "zod";
import { json, handleError, parseJsonBody, ensureAdmin } from "../../_utils.js";

const reorderSchema = z.object({
  pageId: z.number().int().positive(),
  orderedIds: z.array(z.number().int().positive()),
});

export async function onRequestPost({ env, request }) {
  try {
    await ensureAdmin(request, env);
    const body = await parseJsonBody(request, reorderSchema);
    const stmt = env.DB.prepare(
      "UPDATE page_blocks SET sort = ?, updated_at = datetime('now') WHERE id = ? AND page_id = ?"
    );
    for (const [index, id] of body.orderedIds.entries()) {
      await stmt.bind(index, id, body.pageId).run();
    }
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
