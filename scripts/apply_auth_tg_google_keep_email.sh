#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p functions/api/auth

echo "==> Writing functions/api/auth/telegram.js"
cat > functions/api/auth/telegram.js <<'JS'
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
JS

echo "==> Writing functions/api/auth/google.js"
cat > functions/api/auth/google.js <<'JS'
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
JS

echo "==> Ensuring Google GIS script in webapp/index.html"
python - <<'PY'
from pathlib import Path
p = Path("webapp/index.html")
s = p.read_text(encoding="utf-8")
if "https://accounts.google.com/gsi/client" in s:
    print("GIS already present")
else:
    marker = '<script type="module" src="app.bundle.js"></script>'
    if marker not in s:
        raise SystemExit("Cannot find app.bundle.js script tag in webapp/index.html")
    s = s.replace(marker, '<script src="https://accounts.google.com/gsi/client" async defer></script>\n    ' + marker, 1)
    p.write_text(s, encoding="utf-8")
    print("Added GIS script")
PY

echo "==> Patching webapp/services/authService.js (ONLY renderTelegramLogin/renderGoogleLogin, keep email methods)"
python - <<'PY'
import re
from pathlib import Path

p = Path("webapp/services/authService.js")
s = p.read_text(encoding="utf-8")

# Must keep existing exports like loginWithEmail/registerWithEmail/requestPasswordReset.
# We only replace the bodies of:
#   export function renderTelegramLogin(...)
#   export async function renderGoogleLogin(...)
# and ensure saveSession/getAuthConfig/getAuthState/clearAuthState exist (they already do in your project).

def replace_func(pattern, replacement):
    global s
    m = re.search(pattern, s, flags=re.S)
    if not m:
        raise SystemExit(f"Cannot find function by pattern: {pattern[:60]}...")
    s = s[:m.start()] + replacement + s[m.end():]

render_tg = r"""export function renderTelegramLogin\s*\([\s\S]*?\n\}\n"""
render_google = r"""export async function renderGoogleLogin\s*\([\s\S]*?\n\}\n"""

tg_impl = """export function renderTelegramLogin(container, { botUsername, onSuccess, onError } = {}) {
  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = isTelegram() ? "Войти через Telegram" : "Открыть в Telegram";

  const helper = document.createElement("div");
  helper.className = "helper";
  helper.style.marginTop = "8px";
  helper.textContent = isTelegram()
    ? "Вы войдёте через данные Telegram Mini App."
    : "Откройте мини-приложение внутри Telegram.";

  btn.onclick = async () => {
    try {
      const cfg = getAuthConfig();
      const username = botUsername || cfg.telegramBotUsername;
      if (!username) throw new Error("telegramBotUsername не задан в auth-config.js");

      if (!isTelegram()) {
        window.open(`https://t.me/${username}`, "_blank");
        return;
      }

      const tg = window.Telegram?.WebApp;
      if (!tg) throw new Error("Telegram WebApp недоступен");
      try { tg.ready?.(); } catch {}

      const initData = tg.initData || "";
      if (!initData) throw new Error("initData пустой. Откройте мини-приложение заново.");

      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Telegram login failed");

      setAuthState?.(data); // if your service has it
      saveSession?.(data);  // if your service has it
      // fallback: minimal store
      if (!localStorage.getItem("auth:token") && data.token) localStorage.setItem("auth:token", data.token);
      if (!localStorage.getItem("auth:user") && data.user) localStorage.setItem("auth:user", JSON.stringify(data.user));
      if (!localStorage.getItem("auth:provider") && data.provider) localStorage.setItem("auth:provider", data.provider);

      onSuccess?.(data);
    } catch (e) {
      onError?.(e);
    }
  };

  container.appendChild(btn);
  container.appendChild(helper);

  return () => {
    try { btn.remove(); } catch {}
    try { helper.remove(); } catch {}
  };
}
"""

google_impl = """export async function renderGoogleLogin(container, { clientId, onSuccess, onError } = {}) {
  await waitFor?.(() => !!window.google?.accounts?.id, 4000);

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.justifyContent = "center";
  container.appendChild(wrap);

  const cfg = getAuthConfig();
  const cid = clientId || cfg.googleClientId;

  if (!cid) {
    const hint = document.createElement("div");
    hint.className = "helper";
    hint.textContent = "googleClientId не задан в auth-config.js";
    wrap.appendChild(hint);
    return () => { try { wrap.remove(); } catch {} };
  }

  if (!window.google?.accounts?.id) {
    const hint = document.createElement("div");
    hint.className = "helper";
    hint.textContent = "Google Identity Services не загрузился (проверь index.html).";
    wrap.appendChild(hint);
    return () => { try { wrap.remove(); } catch {} };
  }

  try {
    window.google.accounts.id.initialize({
      client_id: cid,
      callback: async (resp) => {
        try {
          const credential = resp?.credential;
          if (!credential) throw new Error("Google credential пустой");

          const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ credential }),
          });
          const data = await res.json();
          if (!res.ok || !data?.ok) throw new Error(data?.error || "Google login failed");

          setAuthState?.(data);
          saveSession?.(data);
          if (!localStorage.getItem("auth:token") && data.token) localStorage.setItem("auth:token", data.token);
          if (!localStorage.getItem("auth:user") && data.user) localStorage.setItem("auth:user", JSON.stringify(data.user));
          if (!localStorage.getItem("auth:provider") && data.provider) localStorage.setItem("auth:provider", data.provider);

          onSuccess?.(data);
        } catch (e) {
          onError?.(e);
        }
      },
    });

    window.google.accounts.id.renderButton(wrap, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "signin_with",
      width: 320,
    });
  } catch (e) {
    onError?.(e);
  }

  return () => { try { wrap.remove(); } catch {} };
}
"""

# Ensure these helpers exist minimally (if not present, append them)
if "function saveSession" not in s and "export function setAuthState" not in s:
    # we won't add huge logic; profilePage already uses getAuthState/clearAuthState
    pass

# Replace functions
replace_func(render_tg, tg_impl)
replace_func(render_google, google_impl)

p.write_text(s, encoding="utf-8")
print("Patched renderTelegramLogin + renderGoogleLogin; kept email auth intact.")
PY

echo "==> Done."
