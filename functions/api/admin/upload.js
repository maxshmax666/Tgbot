import { json, handleError, ensureOwner, RequestError, requireEnv } from "../_utils.js";

export async function onRequestPost({ env, request }) {
  try {
    await ensureOwner(request, env);
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      throw new RequestError(400, "Expected multipart/form-data");
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") throw new RequestError(400, "File is required");

    const bucket = env.MEDIA_BUCKET;
    if (!bucket) throw new RequestError(500, "MEDIA_BUCKET binding is missing");
    const key = `${crypto.randomUUID()}-${file.name}`;
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });

    const publicBase = requireEnv(env.R2_PUBLIC_URL, "R2_PUBLIC_URL");
    const url = `${publicBase.replace(/\/$/, "")}/${key}`;
    const meta = { name: file.name, size: file.size, type: file.type };

    await env.DB.prepare(
      "INSERT INTO media (key, url, created_at, meta_json) VALUES (?, ?, datetime('now'), ?)"
    )
      .bind(key, url, JSON.stringify(meta))
      .run();

    return json({ key, url, meta });
  } catch (err) {
    return handleError(err);
  }
}
