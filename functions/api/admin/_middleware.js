import { handleError, requireAuth, RequestError } from "../_utils.js";

const PUBLIC_PATHS = new Set(["/api/admin/auth/login", "/api/admin/auth/logout"]);

export async function onRequest({ env, request, next }) {
  const { pathname } = new URL(request.url);
  if (request.method === "OPTIONS" || PUBLIC_PATHS.has(pathname)) {
    return next();
  }

  try {
    if (!env.DB) {
      throw new RequestError(500, "DB binding is missing");
    }
    await requireAuth(request, env);
    return await next();
  } catch (err) {
    return handleError(err);
  }
}
