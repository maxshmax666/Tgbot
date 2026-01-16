import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { formatPrice } from "../services/format.js";
import { getOrders, getFavorites } from "../services/storageService.js";
import { setState } from "../store/cartStore.js";
import { sendData, showTelegramAlert, getUser, isTelegram } from "../services/telegramService.js";
import { showToast } from "../ui/toast.js";
import {
  clearAuthState,
  getAuthConfig,
  getAuthState,
  loginWithEmail,
  registerWithEmail,
  requestPasswordReset,
  renderGoogleLogin,
  renderTelegramLogin,
} from "../services/authService.js";

function computeStats(orders) {
  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const avgCheck = totalOrders ? Math.round(totalSpent / totalOrders) : 0;
  const favMap = new Map();
  orders.forEach((order) => {
    order.items?.forEach((item) => {
      favMap.set(item.title, (favMap.get(item.title) || 0) + item.qty);
    });
  });
  const favorite = Array.from(favMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  return { totalOrders, totalSpent, avgCheck, favorite };
}

const STATUS_LABELS = {
  "order:sent": "Отправлен",
  "order:pending_sync": "Ожидает синхронизации",
  "order:error": "Ошибка",
  "order:success": "Отправлен",
};

function getStatusLabel(status) {
  return STATUS_LABELS[status] || "Отправлен";
}

export function renderProfilePage({ navigate }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);
  const authConfig = getAuthConfig();
  let cleanupAuth = null;

  const render = () => {
    if (cleanupAuth) {
      cleanupAuth();
      cleanupAuth = null;
    }
    clearElement(content);
    const orders = getOrders();
    const favorites = getFavorites();
    const stats = computeStats(orders);
    const telegramUser = getUser();
    const storedAuth = getAuthState();
    const isMiniApp = isTelegram();
    const user = isMiniApp ? telegramUser : storedAuth?.user;
    const provider = isMiniApp ? "telegram-webapp" : storedAuth?.provider;
    const isEmailEnabled = authConfig.emailEnabled !== false;
    const isDebugEnabled =
      Boolean(authConfig?.debug) &&
      new URLSearchParams(window.location.search).get("debug") === "1";
    // DEBUG_AUTH_PANEL
    if (isDebugEnabled) {
      try {
        const dbg = createElement("pre", {
          className: "panel",
          text:
            "DEBUG AUTH\n" +
            "isMiniApp: " + String(isMiniApp) + "\n" +
            "telegramUser: " + JSON.stringify(telegramUser || null) + "\n" +
            "storedAuth: " + JSON.stringify(storedAuth || null) + "\n" +
            "computed user: " + JSON.stringify(user || null) + "\n" +
            "provider: " + String(provider || "") + "\n",
        });
        content.appendChild(dbg);
      } catch (e) {}
    }


    if (!user) {
      const authPanel = createElement("div", { className: "panel" });
      authPanel.appendChild(createElement("h2", { className: "title", text: "Вход" }));
      authPanel.appendChild(
        createElement("p", {
          className: "helper",
          text: "Авторизация нужна, чтобы сохранить профиль между устройствами.",
        })
      );

      const telegramWrap = createElement("div", { className: "auth-actions" });
      const googleWrap = createElement("div", { className: "auth-actions" });
      const emailWrap = createElement("div", { className: "auth-actions" });

      const cleanupFns = [];

      if (authConfig.telegramBotUsername) {
        authPanel.appendChild(
          createElement("div", { className: "section-title", text: "Telegram" })
        );
        authPanel.appendChild(telegramWrap);
        const telegramCleanup = renderTelegramLogin(telegramWrap, {
          botUsername: authConfig.telegramBotUsername,
          onSuccess: () => {
            showToast("Вход через Telegram выполнен", "success");
            render();
          },
          onError: (error) => {
            showToast(error?.message || "Не удалось войти через Telegram", "error");
          },
        });
        cleanupFns.push(telegramCleanup);
      } else {
        authPanel.appendChild(
          createElement("p", {
            className: "helper",
            text: "Добавьте PUBLIC_AUTH_CONFIG.telegramBotUsername в auth-config.js.",
          })
        );
      }

      if (authConfig.googleClientId) {
        authPanel.appendChild(
          createElement("div", { className: "section-title", text: "Google" })
        );
        authPanel.appendChild(googleWrap);
        renderGoogleLogin(googleWrap, {
          clientId: authConfig.googleClientId,
          onSuccess: () => {
            showToast("Вход через Google выполнен", "success");
            render();
          },
          onError: (error) => {
            showToast(error?.message || "Не удалось войти через Google", "error");
          },
        })
          .then((googleCleanup) => cleanupFns.push(googleCleanup))
          .catch((error) => {
            showToast(error?.message || "Google login недоступен", "error");
          });
      } else {
        authPanel.appendChild(
          createElement("p", {
            className: "helper",
            text: "Добавьте PUBLIC_AUTH_CONFIG.googleClientId в auth-config.js.",
          })
        );
      }

      if (isEmailEnabled) {
        authPanel.appendChild(createElement("div", { className: "section-title", text: "Email" }));
        const emailInput = createElement("input", {
          className: "input",
          attrs: { type: "email", placeholder: "Email" },
        });
        const passwordInput = createElement("input", {
          className: "input",
          attrs: { type: "password", placeholder: "Пароль (мин. 8 символов)" },
        });
        const emailActions = createElement("div", { className: "auth-actions" });
        const loginButton = createButton({
          label: "Войти",
          onClick: async () => {
            try {
              const email = emailInput.value.trim();
              const password = passwordInput.value;
              if (!email || !password) {
                showToast("Укажите email и пароль", "info");
                return;
              }
              await loginWithEmail({ email, password });
              showToast("Вход по email выполнен", "success");
              render();
            } catch (error) {
              showToast(error?.message || "Ошибка", "error");
            }
          },
        });
        const registerButton = createButton({
          label: "Зарегистрироваться",
          variant: "secondary",
          onClick: async () => {
            try {
              const email = emailInput.value.trim();
              const password = passwordInput.value;
              if (!email || !password) {
                showToast("Укажите email и пароль", "info");
                return;
              }
              await registerWithEmail({ email, password });
              showToast("Письмо с подтверждением отправлено", "success");
            } catch (error) {
              showToast(error?.message || "Ошибка", "error");
            }
          },
        });
        const resetButton = createButton({
          label: "Сбросить пароль",
          variant: "ghost",
          onClick: async () => {
            try {
              const email = emailInput.value.trim();
              if (!email) {
                showToast("Укажите email для сброса", "info");
                return;
              }
              await requestPasswordReset(email);
              showToast("Ссылка для сброса отправлена на почту", "success");
            } catch (error) {
              showToast(error?.message || "Ошибка", "error");
            }
          },
        });
        const clearSessionButton = createButton({
          label: "Сбросить авторизацию",
          variant: "ghost",
          onClick: () => {
            try { clearAuthState(); } catch {}
            try {
              localStorage.removeItem("auth:token");
              localStorage.removeItem("auth:user");
              localStorage.removeItem("auth:provider");
            } catch {}
            showToast("Сессия очищена", "success");
            render();
          },
        });

        emailActions.append(loginButton, registerButton, resetButton, clearSessionButton);
        emailWrap.append(emailInput, passwordInput, emailActions);
        authPanel.appendChild(emailWrap);
      }

      cleanupAuth = () => cleanupFns.forEach((fn) => fn?.());

      content.appendChild(authPanel);
    }

    if (user) {
      const userPanel = createElement("div", { className: "panel" });
      userPanel.appendChild(createElement("h2", { className: "title", text: "Профиль" }));
      const displayName =
        user.first_name || user.name || user.username || user.email || `User ${user.id || ""}`;
      userPanel.appendChild(
        createElement("div", {
          className: "helper",
          text: `Провайдер: ${provider || "—"}`,
        })
      );
      userPanel.appendChild(
        createElement("div", {
          className: "helper",
          text: `Имя: ${displayName}`,
        })
      );
      if (!isMiniApp) {
        const logout = createButton({
          label: "Выйти",
          variant: "secondary",
          onClick: () => {
            clearAuthState();
            render();
          },
        });
        userPanel.appendChild(logout);
      }
      content.appendChild(userPanel);
    }

    const summary = createElement("div", { className: "panel" });
    summary.appendChild(createElement("h2", { className: "title", text: "Профиль" }));
    summary.appendChild(createElement("div", { className: "helper", text: `Заказов: ${stats.totalOrders}` }));
    summary.appendChild(createElement("div", { className: "helper", text: `Средний чек: ${formatPrice(stats.avgCheck)}` }));
    summary.appendChild(createElement("div", { className: "helper", text: `Любимая пицца: ${stats.favorite}` }));
    summary.appendChild(createElement("div", { className: "helper", text: `Потрачено: ${formatPrice(stats.totalSpent)}` }));

    const favPanel = createElement("div", { className: "panel" });
    favPanel.appendChild(createElement("h3", { className: "section-title", text: "Избранное" }));
    if (!favorites.size) {
      favPanel.appendChild(createElement("p", { className: "helper", text: "Избранных пицц пока нет." }));
    } else {
      favPanel.appendChild(
        createElement("p", { className: "helper", text: `В избранном: ${favorites.size}` })
      );
    }

    const history = createElement("div", { className: "panel" });
    history.appendChild(createElement("h3", { className: "section-title", text: "Последние заказы" }));
    if (!orders.length) {
      history.appendChild(createElement("p", { className: "helper", text: "История заказов пуста." }));
    } else {
      orders.slice(0, 10).forEach((order) => {
        const row = createElement("div", { className: "order-row" });
        row.appendChild(
          createElement("div", {
            text: `#${order.order_id || "—"} • ${formatPrice(order.total || 0)}`,
          })
        );
        const status = createElement("div", {
          className: "helper",
          text: getStatusLabel(order.status),
        });
        const items = createElement("div", {
          className: "helper",
          text: order.items?.map((item) => `${item.title} × ${item.qty}`).join(", ") || "",
        });
        const repeat = createButton({
          label: "Повторить заказ",
          variant: "secondary",
          onClick: () => {
            setState(order.items || []);
            showToast("Позиции добавлены в корзину", "success");
            navigate("/cart");
          },
        });
        row.append(status, items, repeat);
        history.appendChild(row);
      });
    }

    const feedback = createElement("div", { className: "panel" });
    feedback.appendChild(createElement("h3", { className: "section-title", text: "Оставить отзыв" }));
    const feedbackInput = createElement("textarea", {
      className: "input",
      attrs: { placeholder: "Напишите отзыв или пожелание" },
    });
    const feedbackButton = createButton({
      label: "Отправить",
      onClick: () => {
        const message = feedbackInput.value.trim();
        if (!message) {
          showToast("Введите отзыв", "info");
          return;
        }
        const sent = sendData({ type: "feedback_v1", message, ts: Date.now() });
        if (sent) {
          showTelegramAlert("Спасибо за отзыв!");
        } else {
          showToast("Отзыв сохранён локально", "info");
        }
        feedbackInput.value = "";
      },
    });
    feedback.append(feedbackInput, feedbackButton);

    content.append(summary, favPanel, history, feedback);
  };

  render();
  return { element: root };
}
