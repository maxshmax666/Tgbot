import React, { useEffect, useState } from "https://esm.sh/react@18.2.0";
import { createPortal } from "https://esm.sh/react-dom@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";

let mainButtonHandler = null;
let confirmRoot = null;
let confirmContainer = null;
let confirmResolve = null;

const ensureConfirmRoot = () => {
  if (!confirmContainer) {
    confirmContainer = document.createElement("div");
    confirmContainer.id = "admin-confirm-popup-root";
    document.body.appendChild(confirmContainer);
  }
  if (!confirmRoot) {
    confirmRoot = createRoot(confirmContainer);
  }
};

const cleanupConfirmRoot = () => {
  if (confirmRoot) {
    confirmRoot.unmount();
    confirmRoot = null;
  }
  if (confirmContainer) {
    confirmContainer.remove();
    confirmContainer = null;
  }
  confirmResolve = null;
};

function ConfirmModal({
  message,
  title,
  okText,
  cancelText,
  onConfirm,
  onCancel,
}) {
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = (confirmed) => {
    setIsOpen(false);
    if (confirmed) {
      onConfirm();
    } else {
      onCancel();
    }
  };

  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        handleClose(false);
      }
      if (event.key === "Enter") {
        handleClose(true);
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900 p-6 text-slate-100 shadow-xl space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-slate-300 whitespace-pre-line">{message}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded-md text-sm font-medium transition bg-slate-700 hover:bg-slate-600 text-white"
            onClick={() => handleClose(false)}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-md text-sm font-medium transition bg-rose-500 hover:bg-rose-600 text-white"
            onClick={() => handleClose(true)}
          >
            {okText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const getWebApp = () => window.Telegram?.WebApp || null;

const hasValidPlatform = (webApp) =>
  Boolean(
    webApp &&
      typeof webApp.platform === "string" &&
      webApp.platform.trim().length > 0 &&
      typeof webApp.version === "string" &&
      webApp.version.trim().length > 0
  );

const hasInitData = (webApp) => Boolean(webApp?.initData);

export function getTelegramState() {
  const webApp = getWebApp();
  const available = hasValidPlatform(webApp);
  return {
    available,
    missingInitData: available && !hasInitData(webApp),
  };
}

export function isTelegram() {
  return getTelegramState().available;
}

export function initTelegram() {
  const webApp = getWebApp();
  const state = getTelegramState();
  if (!webApp || !state.available) return { available: false, missingInitData: false };
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
  return state;
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

export function confirmPopup({
  message,
  title = "Подтверждение",
  okText = "OK",
  cancelText = "Cancel",
} = {}) {
  const webApp = getWebApp();
  if (webApp?.showPopup) {
    return new Promise((resolve) => {
      webApp.showPopup(
        {
          title,
          message: message || "",
          buttons: [
            { id: "cancel", type: "cancel", text: cancelText },
            { id: "ok", type: "ok", text: okText },
          ],
        },
        (buttonId) => resolve(buttonId === "ok")
      );
    });
  }

  return new Promise((resolve) => {
    if (!document?.body) {
      resolve(false);
      return;
    }
    if (confirmResolve) {
      confirmResolve(false);
      cleanupConfirmRoot();
    }
    ensureConfirmRoot();
    confirmResolve = resolve;
    const handleResolve = (confirmed) => {
      resolve(confirmed);
      cleanupConfirmRoot();
    };
    confirmRoot.render(
      <ConfirmModal
        title={title}
        message={message || ""}
        okText={okText}
        cancelText={cancelText}
        onConfirm={() => handleResolve(true)}
        onCancel={() => handleResolve(false)}
      />
    );
  });
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
