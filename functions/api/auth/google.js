import { createSessionCookie, createToken, handleError, json, RequestError, requireEnv } from "../_utils.js";

const ADMIN_ROLES = new Set(["owner", "admin"]);

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const credential = body?.credential;

    if (!credential || typeof credential !== "string") {
      throw new RequestError(400, "credential is required");
    }

    const clientId = requireEnv(env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
    requireEnv(env.JWT_SECRET, "JWT_SECRET");

    const url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential);
    const res = await fetch(url);
    const info = await res.json();

    if (!res.ok) throw new RequestError(401, info?.error_description || "Invalid Google token");
    if (info.aud !== clientId) throw new RequestError(401, "Google token audience mismatch");

    const user = {
      sub: info.sub,
      email: info.email,
      email_verified: info.email_verified === "true" || info.email_verified === true,
      name: info.name,
      picture: info.picture,
      given_name: info.given_name,
      family_name: info.family_name,
    };

    if (!user.email || !user.email_verified) {
      throw new RequestError(401, "Google email not verified");
    }

    let role = "user";
    let adminId = null;
    if (env.DB) {
      const admin = await env.DB
        .prepare("SELECT id, role, email_verified_at FROM users WHERE email = ? LIMIT 1")
        .bind(user.email)
        .first();
      if (admin && ADMIN_ROLES.has(admin.role) && admin.email_verified_at) {
        role = admin.role;
        adminId = admin.id;
      }
    }

    const token = await createToken(
      {
        sub: adminId ? `user:${String(adminId)}` : `google:${String(user.sub)}`,
        provider: "google",
        role,
        email: user.email,
        name: user.name,
      },
      env
    );

    const headers = role !== "user" ? { "set-cookie": createSessionCookie(token, request) } : {};
    return json({ ok: true, token, user, provider: "google", role }, 200, headers);
  } catch (err) {
    return handleError(err);
  }
}
