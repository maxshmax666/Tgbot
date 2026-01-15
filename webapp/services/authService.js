import { storage, STORAGE_KEYS } from "./storageService.js";

const scriptCache = new Map();

const DEFAULT_CONFIG = {
  telegramBotUsername: "",
  googleClientId: "",
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

export function renderTelegramLogin(container, { botUsername, onSuccess, onError }) {
  if (!botUsername) {
    throw new Error("Telegram bot username is missing");
  }
  const callbackName = `onTelegramAuth_${Math.random().toString(36).slice(2)}`;
  window[callbackName] = async (user) => {
    try {
      const payload = await loginWithTelegram(user);
      onSuccess?.(payload);
    } catch (error) {
      onError?.(error);
    }
  };

  container.innerHTML = "";
  const script = document.createElement("script");
  script.src = "https://telegram.org/js/telegram-widget.js?22";
  script.async = true;
  script.dataset.telegramLogin = botUsername;
  script.dataset.size = "large";
  script.dataset.userpic = "true";
  script.dataset.requestAccess = "write";
  script.dataset.onauth = `${callbackName}(user)`;
  container.appendChild(script);

  return () => {
    delete window[callbackName];
    container.innerHTML = "";
  };
}

export async function renderGoogleLogin(container, { clientId, onSuccess, onError }) {
  if (!clientId) {
    throw new Error("Google client ID is missing");
  }
  await loadScriptOnce("https://accounts.google.com/gsi/client");
  if (!window.google?.accounts?.id) {
    throw new Error("Google Identity Services unavailable");
  }
  window.google.accounts.id.initialize({
    client_id: clientId,
    ux_mode: "popup",
    callback: async (response) => {
      try {
        const payload = await loginWithGoogle(response.credential);
        onSuccess?.(payload);
      } catch (error) {
        onError?.(error);
      }
    },
  });
  container.innerHTML = "";
  window.google.accounts.id.renderButton(container, {
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "pill",
  });
  return () => {
    container.innerHTML = "";
  };
}
