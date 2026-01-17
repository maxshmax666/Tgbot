// Clean Telegram WebApp helpers (no React/JSX)
function getWebApp() { return window.Telegram?.WebApp || null; }

function getAvailabilityState() {
  const wa = getWebApp();
  const initData = wa?.initData;
  const user = wa?.initDataUnsafe?.user;
  const hasInitData = typeof initData === "string" && initData.trim().length > 0;
  const userValid = !user || (typeof user === "object" && !Array.isArray(user));
  const available = Boolean(wa && userValid);
  return { available, missingInitData: available && !hasInitData };
}

export function isTelegram() {
  const { available, missingInitData } = getAvailabilityState();
  return available && !missingInitData;
}

export function initTelegram() {
  const wa = getWebApp();
  const state = getAvailabilityState();
  if (!wa) return state;
  try { wa.ready?.(); } catch {}
  try { wa.expand?.(); } catch {}
  try { wa.setHeaderColor?.("#0b0b0b"); } catch {}
  try { wa.setBackgroundColor?.("#0b0b0b"); } catch {}
  return state;
}

export function getUser() {
  const wa = getWebApp();
  const u = wa?.initDataUnsafe?.user || null;
  return u && typeof u === "object" ? u : null;
}

export function getTelegramState() {
  const wa = getWebApp();
  return {
    isTelegram: isTelegram(),
    platform: wa?.platform || null,
    version: wa?.version || null,
    initData: wa?.initData || "",
    user: getUser(),
    ...getAvailabilityState(),
  };
}

export function sendData(payload) {
  const wa = getWebApp();
  if (!wa?.sendData) return false;
  try {
    const data = typeof payload === "string" ? payload : JSON.stringify(payload);
    wa.sendData(data);
    return true;
  } catch { return false; }
}

export function showTelegramAlert(message, title = "Сообщение") {
  const wa = getWebApp();
  if (wa?.showPopup) {
    return new Promise((resolve) => {
      try {
        wa.showPopup(
          { title, message: String(message ?? ""), buttons: [{ id: "ok", type: "ok", text: "OK" }] },
          () => resolve()
        );
      } catch {
        try { alert(String(message ?? "")); } catch {}
        resolve();
      }
    });
  }
  return new Promise((resolve) => { try { alert(String(message ?? "")); } catch {} resolve(); });
}

export function showTelegramConfirm(message, title="Подтвердите", okText="OK", cancelText="Отмена") {
  const wa = getWebApp();
  if (wa?.showPopup) {
    return new Promise((resolve) => {
      try {
        wa.showPopup(
          {
            title,
            message: String(message ?? ""),
            buttons: [
              { id: "cancel", type: "cancel", text: cancelText },
              { id: "ok", type: "ok", text: okText },
            ],
          },
          (buttonId) => resolve(buttonId === "ok")
        );
      } catch {
        resolve(Boolean(confirm(String(message ?? ""))));
      }
    });
  }
  return Promise.resolve(Boolean(confirm(String(message ?? ""))));
}

export function confirmPopup({ message, title = "Подтвердите", okText = "OK", cancelText = "Отмена" }) {
  return showTelegramConfirm(message, title, okText, cancelText);
}
