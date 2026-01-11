const webApp = window.Telegram?.WebApp || null;

export function initTelegram() {
  if (!webApp) return { available: false };
  webApp.ready();
  webApp.expand();
  return { available: true };
}

export function sendOrderToTelegram(order) {
  if (!webApp) {
    throw new Error("Telegram WebApp недоступен");
  }
  const payload = JSON.stringify(order);
  webApp.sendData(payload);
}

export function showTelegramAlert(message) {
  if (!webApp) return;
  webApp.showAlert(message);
}
