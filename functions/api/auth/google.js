export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const credential = body?.credential;

    if (!credential || typeof credential !== "string") {
      return json({ ok: false, error: "credential is required" }, 400);
    }
    if (!env.GOOGLE_CLIENT_ID) {
      return json({ ok: false, error: "Server misconfigured: GOOGLE_CLIENT_ID missing" }, 500);
    }
    if (!env.JWT_SECRET) {
      return json({ ok: false, error: "Server misconfigured: JWT_SECRET missing" }, 500);
    }

    const url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential);
    const res = await fetch(url);
    const info = await res.json();

    if (!res.ok) return json({ ok: false, error: info?.error_description || "Invalid Google token" }, 401);
    if (info.aud !== env.GOOGLE_CLIENT_ID) return json({ ok: false, error: "Google token audience mismatch" }, 401);

    const user = {
      sub: info.sub,
      email: info.email,
      email_verified: info.email_verified === "true" || info.email_verified === true,
      name: info.name,
      picture: info.picture,
      given_name: info.given_name,
      family_name: info.family_name,
    };

    const token = await signJwtHS256(
      { sub: String(user.sub), provider: "google", user, iat: now(), exp: now() + 60 * 60 * 24 * 30 },
      env.JWT_SECRET
    );

    return json({ ok: true, token, user, provider: "google" });
  } catch (e) {
    return json({ ok: false, error: e?.message || "Unknown error" }, 500);
  }
}

function now() { return Math.floor(Date.now() / 1000); }
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function signJwtHS256(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = new TextEncoder();
  const base64url = (obj) =>
    btoa(String.fromCharCode(...enc.encode(JSON.stringify(obj))))
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const h = base64url(header);
  const p = base64url(payload);
  const data = `${h}.${p}`;

  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const s = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${data}.${s}`;
}
