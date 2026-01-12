let mainButtonHandler = null;

const getWebApp = () => window.Telegram?.WebApp || null;

export function isTelegram() {
  const webApp = getWebApp();
  return Boolean(webApp?.initData || webApp?.initDataUnsafe?.user);
}

export function initTelegram() {
  const webApp = getWebApp();
  if (!webApp || !isTelegram()) return { available: false };
  try {
    webApp.ready();
    webApp.expand();
    if (typeof webApp.setHeaderColor === "function") {
      webApp.setHeaderColor("#0f1115");
    }
    if (typeof webApp.setBackgroundColor === "function") {
      webApp.setBackgroundColor("#0f1115");
    }
  } catch (error) {
    console.warn("Telegram init failed", error);
  }
  return { available: true };
}

export function getUser() {
  const webApp = getWebApp();
  return webApp?.initDataUnsafe?.user || null;
}

export function setMainButton(text, handler) {
  const webApp = getWebApp();
  if (!webApp?.MainButton) return;
  if (mainButtonHandler) {
    webApp.MainButton.offClick(mainButtonHandler);
  }
  mainButtonHandler = handler;
  webApp.MainButton.setText(text);
  webApp.MainButton.show();
  if (handler) {
    webApp.MainButton.onClick(handler);
  }
}

export function hideMainButton() {
  const webApp = getWebApp();
  if (webApp?.MainButton) {
    webApp.MainButton.hide();
  }
}

export function enableMainButton() {
  const webApp = getWebApp();
  if (webApp?.MainButton) {
    webApp.MainButton.enable();
  }
}

export function disableMainButton() {
  const webApp = getWebApp();
  if (webApp?.MainButton) {
    webApp.MainButton.disable();
  }
}

export function haptic(type = "impact", style = "light") {
  const webApp = getWebApp();
  if (!webApp?.HapticFeedback) return;
  try {
    if (type === "notification") {
      webApp.HapticFeedback.notificationOccurred(style);
    } else {
      webApp.HapticFeedback.impactOccurred(style);
    }
  } catch (error) {
    console.warn("Haptic failed", error);
  }
}

export function showTelegramAlert(message) {
  const webApp = getWebApp();
  if (webApp?.showAlert) {
    webApp.showAlert(message);
    return;
  }
  window.alert(message);
}

export function showTelegramPopup(options, callback) {
  const webApp = getWebApp();
  if (webApp?.showPopup) {
    webApp.showPopup(options, callback);
    return;
  }
  if (options?.buttons?.length) {
    const confirmed = window.confirm(options.message || "");
    const buttonId = confirmed
      ? options.buttons.find((button) => button.type === "ok")?.id
      : options.buttons.find((button) => button.type === "cancel")?.id;
    if (buttonId && typeof callback === "function") {
      callback(buttonId);
    }
    return;
  }
  window.alert(options?.message || "");
}

export function sendData(payload) {
  const webApp = getWebApp();
  if (!webApp) return false;
  try {
    webApp.sendData(JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn("Telegram sendData failed", error);
    return false;
  }
}
