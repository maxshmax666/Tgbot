import { storage, STORAGE_KEYS } from "./storageService.js";
import { isTelegram } from "./telegramService.js";

const scriptCache = new Map();

const DEFAULT_CONFIG = {
  telegramBotUsername: "",
  googleClientId: "",
  debug: false,
};

const getConfig = () => {
  if (typeof window === "undefined") return { ...DEFAULT_CONFIG };
  return { ...DEFAULT_CONFIG, ...(window.PUBLIC_AUTH_CONFIG || {}) };
};

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || "Auth failed";
    const details = payload?.error?.details;
    throw new Error(details ? `${message}: ${JSON.stringify(details)}` : message);
  }
  return payload;
};

const loadScriptOnce = (src) => {
  if (scriptCache.has(src)) return scriptCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
  scriptCache.set(src, promise);
  return promise;
};

const getGlobal = (path) => {
  return path.split(".").reduce((acc, key) => acc?.[key], window);
};

const waitForGlobal = (path, timeout = 4000, interval = 50) => {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (getGlobal(path)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (getGlobal(path)) return resolve(true);
      if (Date.now() - start >= timeout) return resolve(false);
      setTimeout(tick, interval);
    };
    tick();
  });
};

export function getAuthConfig() {
  return getConfig();
}

export function getAuthState() {
  return storage.read(STORAGE_KEYS.userAuth, null);
}

export function setAuthState(payload) {
  storage.write(STORAGE_KEYS.userAuth, payload);
}

export function clearAuthState() {
  storage.remove(STORAGE_KEYS.userAuth);
}

export async function loginWithTelegram(authData) {
  const response = await fetch("/api/public/auth/telegram", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(authData),
  });
  const payload = await parseResponse(response);
  setAuthState({ provider: "telegram", ...payload });
  return payload;
}

export async function loginWithGoogle(credential) {
  const response = await fetch("/api/public/auth/google", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  const payload = await parseResponse(response);
  setAuthState({ provider: "google", ...payload });
  return payload;
}

export async function registerWithEmail({ email, password }) {
  const response = await fetch("/api/public/auth/email-register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseResponse(response);
}

export async function loginWithEmail({ email, password }) {
  const response = await fetch("/api/public/auth/email-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await parseResponse(response);
  setAuthState({ provider: "email", ...payload });
  return payload;
}

export async function requestPasswordReset(email) {
  const response = await fetch("/api/public/auth/password-reset/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseResponse(response);
}

export async function confirmPasswordReset({ token, password }) {
  const response = await fetch("/api/public/auth/password-reset/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  return parseResponse(response);
}

export function renderTelegramLogin(container, { botUsername, onSuccess, onError } = {}) {
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

      setAuthState({ provider: "telegram", ...data });
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

export async function renderGoogleLogin(container, { clientId, onSuccess, onError } = {}) {
  await waitForGlobal("google.accounts.id", 4000);

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

          setAuthState({ provider: "google", ...data });
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
