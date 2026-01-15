export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const initData = body?.initData;

    if (!initData || typeof initData !== "string") {
      return json({ ok: false, error: "initData is required" }, 400);
    }
    if (!env.TELEGRAM_BOT_TOKEN) {
      return json({ ok: false, error: "Server misconfigured: TELEGRAM_BOT_TOKEN missing" }, 500);
    }
    if (!env.JWT_SECRET) {
      return json({ ok: false, error: "Server misconfigured: JWT_SECRET missing" }, 500);
    }

    const verified = await verifyTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
    if (!verified.ok) return json({ ok: false, error: verified.error }, 401);

    const user = verified.user;
    const token = await signJwtHS256(
      {
        sub: String(user.id),
        provider: "telegram",
        user,
        iat: now(),
        exp: now() + 60 * 60 * 24 * 30,
      },
      env.JWT_SECRET
    );

    return json({ ok: true, token, user, provider: "telegram" });
  } catch (e) {
    return json({ ok: false, error: e?.message || "Unknown error" }, 500);
  }
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function verifyTelegramInitData(initData, botToken) {
  const params = new URLSearchParams(initData);

  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "Missing hash" };
  params.delete("hash");

  const pairs = [];
  for (const [k, v] of params.entries()) pairs.push([k, v]);
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = await hmacSha256Raw("WebAppData", botToken);
  const computed = await hmacSha256HexWithKey(secretKey, dataCheckString);

  if (!timingSafeEqualHex(computed, hash)) return { ok: false, error: "Invalid hash" };

  const authDate = Number(params.get("auth_date") || "0");
  if (!authDate) return { ok: false, error: "Missing auth_date" };
  const age = now() - authDate;
  if (age > 60 * 60 * 24 * 7) return { ok: false, error: "initData too old" };

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, error: "Missing user" };

  let user;
  try { user = JSON.parse(userRaw); } catch { return { ok: false, error: "Invalid user json" }; }
  if (!user?.id) return { ok: false, error: "Missing user.id" };

  return { ok: true, user };
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmacSha256Raw(keyStr, msgStr) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(keyStr), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msgStr));
  return new Uint8Array(sig);
}

async function hmacSha256HexWithKey(rawKeyBytes, msgStr) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", rawKeyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msgStr));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
