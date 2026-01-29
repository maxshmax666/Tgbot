import { createRemoteJWKSet, jwtVerify } from "jose";
import { createSessionCookie, createToken, handleError, json, RequestError, requireEnv } from "../_utils.js";

const ADMIN_ROLES = new Set(["owner", "admin"]);
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const credential = body?.credential;

    if (!credential || typeof credential !== "string") {
      throw new RequestError(400, "credential is required");
    }

    const clientId = requireEnv(env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
    requireEnv(env.JWT_SECRET, "JWT_SECRET");

    const { payload } = await jwtVerify(credential, googleJwks, {
      audience: clientId,
    });
    if (!payload.iss || !GOOGLE_ISSUERS.has(String(payload.iss))) {
      throw new RequestError(401, "Invalid Google issuer");
    }
    if (!payload.email || payload.email_verified !== true) {
      throw new RequestError(401, "Google email not verified");
    }

    const user = {
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified,
      name: payload.name,
      picture: payload.picture,
      given_name: payload.given_name,
      family_name: payload.family_name,
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
