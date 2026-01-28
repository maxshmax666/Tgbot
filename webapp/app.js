import { initTelegram, isTelegram, getUser } from "./services/telegramService.js";
import { count, subscribeCart } from "./store/cartStore.js";
import { renderMenuPage } from "./pages/menuPage.js";
import { renderCartPage } from "./pages/cartPage.js";
import { renderCheckoutPage } from "./pages/checkoutPage.js";
import { renderPizzaPage } from "./pages/pizzaPage.js";
import { renderProfilePage } from "./pages/profilePage.js";
import { renderHomePage } from "./pages/homePage.js";
import { renderPromosPage } from "./pages/promosPage.js";
import { renderAdminPage } from "./pages/adminPage.js";
import { renderOrderStatusPage } from "./pages/orderStatusPage.js";
import { renderDynamicPage } from "./pages/dynamicPage.js";
import { renderResetPasswordPage } from "./pages/resetPasswordPage.js";
import { renderVerifyEmailPage } from "./pages/verifyEmailPage.js";
import { createElement, clearElement } from "./ui/dom.js";
import { createAppShell } from "./ui/appShell.js";
import { setButtonCurrent } from "./ui/button.js";
import { createErrorState } from "./ui/errorState.js";
import { getLastOrderStatus, storage, STORAGE_KEYS } from "./services/storageService.js";
import { syncPendingOrders } from "./services/orderSyncService.js";
import { loadMenu } from "./store/menuStore.js";
import { fetchConfig } from "./services/configService.js";
import { renderDebugPage } from "./pages/debugPage.js";

const app = document.getElementById("app");
const BUILD_ID = new URL(import.meta.url).searchParams.get("v") || window.BUILD_ID || "dev";
window.BUILD_ID = BUILD_ID;

const bootErrors = [];
const BOOT_ERROR_LIMIT = 2;
let bootFailed = false;

function normalizeError(error) {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack || "" };
  }
  if (typeof error === "string") {
    return { message: error, stack: "" };
  }
  try {
    return { message: JSON.stringify(error), stack: "" };
  } catch {
    return { message: "Unknown error", stack: "" };
  }
}

function recordBootError(error, source) {
  const normalized = normalizeError(error);
  bootErrors.push({
    ...normalized,
    source,
    timestamp: new Date().toISOString(),
  });
  if (bootErrors.length > BOOT_ERROR_LIMIT) {
    bootErrors.shift();
  }
}

function clearAppStorage() {
  Object.values(STORAGE_KEYS).forEach((key) => storage.remove(key));
}

function renderBootFallback() {
  if (!app && !document.body) return;
  const root = app || document.body;
  root.innerHTML = "";

  const wrapper = document.createElement("section");
  wrapper.style.cssText =
    "min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;";
  const card = document.createElement("div");
  card.style.cssText =
    "max-width:560px;width:100%;background:#111827;border-radius:16px;padding:24px;box-shadow:0 24px 48px rgba(15,23,42,0.35);";

  const title = document.createElement("h1");
  title.textContent = "Ошибка загрузки приложения";
  title.style.cssText = "font-size:20px;font-weight:600;margin:0 0 12px;";

  const description = document.createElement("p");
  description.textContent =
    "Вероятно, кэш браузера или Cloudflare отдал старую версию. Нажмите «Перезагрузить страницу» (жёсткая перезагрузка).";
  description.style.cssText = "margin:0 0 16px;color:#cbd5f5;font-size:14px;line-height:1.5;";

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;";

  const reloadButton = document.createElement("button");
  reloadButton.textContent = "Перезагрузить страницу";
  reloadButton.style.cssText =
    "background:#6366f1;color:#fff;border:0;border-radius:10px;padding:10px 14px;font-size:14px;cursor:pointer;";
  reloadButton.addEventListener("click", () => window.location.reload());

  const resetButton = document.createElement("button");
  resetButton.textContent = "Сбросить локальные данные";
  resetButton.style.cssText =
    "background:#1f2937;color:#e2e8f0;border:1px solid #334155;border-radius:10px;padding:10px 14px;font-size:14px;cursor:pointer;";
  resetButton.addEventListener("click", () => {
    clearAppStorage();
    window.location.reload();
  });

  const diagButton = document.createElement("button");
  diagButton.textContent = "Открыть диагностику";
  diagButton.style.cssText =
    "background:transparent;color:#94a3b8;border:1px solid #334155;border-radius:10px;padding:10px 14px;font-size:14px;cursor:pointer;";

  actions.append(reloadButton, resetButton, diagButton);

  const diagnostics = document.createElement("div");
  diagnostics.style.cssText =
    "display:none;background:#0b1120;border-radius:10px;padding:12px;font-size:12px;line-height:1.5;color:#cbd5f5;white-space:pre-wrap;";

  const errorsText = bootErrors
    .map((entry, index) => {
      const source = entry.source ? ` (${entry.source})` : "";
      return `#${index + 1}${source} ${entry.timestamp}\n${entry.message}${entry.stack ? `\n${entry.stack}` : ""}`;
    })
    .join("\n\n");

  diagnostics.textContent = [
    `build: ${BUILD_ID}`,
    `timestamp: ${new Date().toISOString()}`,
    `url: ${window.location.href}`,
    `userAgent: ${window.navigator.userAgent}`,
    errorsText ? `errors:\n${errorsText}` : "errors: (нет записей)",
  ].join("\n");

  diagButton.addEventListener("click", () => {
    const isHidden = diagnostics.style.display === "none";
    diagnostics.style.display = isHidden ? "block" : "none";
  });

  card.append(title, description, actions, diagnostics);
  wrapper.appendChild(card);
  root.appendChild(wrapper);
}

function showBootFailure(message, error, source) {
  recordBootError(error || message, source);
  if (bootFailed) return;
  bootFailed = true;
  renderBootFallback();
}

if (typeof window.PUBLIC_MEDIA_BASE_URL === "undefined") {
  window.PUBLIC_MEDIA_BASE_URL = "";
}

const navItems = [
  { label: "Главная", path: "/" },
  { label: "Меню", path: "/menu" },
  { label: "Корзина", path: "/cart" },
  { label: "Акции", path: "/promos" },
  { label: "Профиль", path: "/profile" },
];
let appShell = null;
let warning = null;
let debugPanel = null;
let topBar = null;
let bottomBar = null;
let content = null;
let routes = [];

function initShell() {
  appShell = createAppShell({
    title: "Пиццерия Тагил",
    subtitle: "Мини‑приложение для заказа пиццы без лишних шагов.",
    navItems,
    onNavigate: (path) => navigate(path),
  });
  ({ warning, debugPanel, topBar, bottomBar, content } = appShell);
  app.append(...appShell.elements);
}

function initRoutes() {
  routes = [
    { path: /^\/$/, render: renderHomePage },
    { path: /^\/home\/?$/, render: renderHomePage },
    { path: /^\/menu\/?$/, render: renderMenuPage },
    { path: /^\/cart\/?$/, render: renderCartPage },
    { path: /^\/checkout\/?$/, render: renderCheckoutPage },
    { path: /^\/promos\/?$/, render: renderPromosPage },
    { path: /^\/profile\/?$/, render: renderProfilePage },
    { path: /^\/reset-password\/?$/, render: renderResetPasswordPage },
    { path: /^\/verify-email\/?$/, render: renderVerifyEmailPage },
    { path: /^\/admin\/login\/?$/, render: renderAdminPage },
    { path: /^\/admin\/?$/, render: renderAdminPage },
    { path: /^\/order-status\/?$/, render: renderOrderStatusPage },
    { path: /^\/debug\/?$/, render: renderDebugPage },
    { path: /^\/pizza\/([^/]+)\/?$/, render: renderPizzaPage },
    { path: /^\/page\/([^/]+)\/?$/, render: renderDynamicPage },
  ];
}

let cleanup = null;
const bootState = {
  ready: false,
  status: "idle",
};
let lastTab = null;

function setAppHeightVar() {
  const height = window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

function getActiveTab(pathname) {
  if (pathname === "/" || pathname.startsWith("/home")) return "/";
  return navItems.find((item) => item.path !== "/" && pathname.startsWith(item.path))?.path || null;
}

function logBoot() {
  const activeTab = getActiveTab(window.location.pathname);
  console.log("[boot] path=", window.location.pathname, "tab=", activeTab, "ready=", bootState.ready);
}

function logTabSwitch(pathname) {
  const activeTab = getActiveTab(pathname);
  if (!activeTab || activeTab === lastTab) return;
  lastTab = activeTab;
  console.info(`[tab] switch to ${activeTab === "/" ? "home" : activeTab.replace("/", "")}`);
}

function logSafeArea() {
  const styles = getComputedStyle(document.documentElement);
  const topInset = parseFloat(styles.getPropertyValue("--safe-area-top")) || 0;
  const bottomInset = parseFloat(styles.getPropertyValue("--safe-area-bottom")) || 0;
  console.info(`[layout] safeArea top=${topInset} bottom=${bottomInset} applied`);
}

function setActiveNav(pathname) {
  const activeTab = getActiveTab(pathname);
  [topBar.nav.buttons, bottomBar.nav.buttons].forEach((buttons) => {
    buttons.forEach((button) => {
      const target = button.dataset.path;
      const isActive = target === activeTab;
      button.classList.toggle("is-active", isActive);
      setButtonCurrent(button, isActive);
    });
  });
}

function renderRoute(pathname) {
  const path = pathname;
  const match = routes.find((route) => route.path.test(path));
  if (!match) {
    navigate("/menu");
    return;
  }

  logBoot();
  logTabSwitch(path);

  const isAdmin = path.startsWith("/admin");
  topBar.element.hidden = isAdmin;
  bottomBar.element.hidden = isAdmin;
  document.body.classList.toggle("admin-mode", isAdmin);

  renderDebug();
  if (cleanup) cleanup();
  clearElement(content);

  try {
    const paramsMatch = path.match(match.path);
    const params = paramsMatch && paramsMatch.length > 1 ? { id: paramsMatch[1] } : {};
    const result = match.render({ navigate, params });
    cleanup = result?.cleanup || null;
    content.appendChild(result.element);
    setActiveNav(path);
    if (typeof result?.restoreScroll === "function") {
      result.restoreScroll();
    }
  } catch (error) {
    console.error("route:render failed", { path, error });
    showFatalError("Страница не загрузилась. Попробуйте перезагрузить.");
  }
}

function showFatalError(message) {
  clearElement(content);
  const reloadButton = createElement("button", {
    className: "button button--primary",
    text: "Перезагрузить",
  });
  reloadButton.addEventListener("click", () => window.location.reload());
  content.appendChild(
    createErrorState({
      title: "Ошибка загрузки",
      description: message,
      action: reloadButton,
    })
  );
}

function navigate(path) {
  window.history.pushState({}, "", path);
  renderRoute(path);
}

window.appNavigate = navigate;

window.addEventListener("popstate", () => renderRoute(window.location.pathname));
window.addEventListener("error", (event) => {
  console.error("window:error", event.error || event.message);
  showBootFailure(
    "Произошла непредвиденная ошибка. Попробуйте перезагрузить приложение.",
    event.error || event.message,
    "window:error"
  );
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("window:unhandledrejection", event.reason);
  showBootFailure(
    "Произошла ошибка сети или данных. Попробуйте перезагрузить приложение.",
    event.reason,
    "window:unhandledrejection"
  );
});
window.addEventListener("online", () => {
  syncPendingOrders();
});
window.addEventListener("resize", setAppHeightVar);
window.addEventListener("orientationchange", setAppHeightVar);
setAppHeightVar();

function renderDebug() {
  const isDebug = new URLSearchParams(window.location.search).get("debug") === "1";
  debugPanel.hidden = !isDebug;
  if (!isDebug) return;
  clearElement(debugPanel);
  const lastStatus = getLastOrderStatus();
  debugPanel.appendChild(createElement("h3", { className: "section-title", text: "Debug" }));
  debugPanel.appendChild(createElement("div", { className: "helper", text: `isTelegram: ${isTelegram()}` }));
  const user = getUser();
  debugPanel.appendChild(
    createElement("div", {
      className: "helper",
      text: `user: ${user?.id || "—"} ${user?.username ? `@${user.username}` : ""}`,
    })
  );
  debugPanel.appendChild(
    createElement("div", {
      className: "helper",
      text: `lastOrderStatus: ${lastStatus?.status || "—"}`,
    })
  );
  debugPanel.appendChild(
    createElement("div", {
      className: "helper",
      text: `cart items: ${count()}`,
    })
  );
  debugPanel.appendChild(
    createElement("div", {
      className: "helper",
      text: `storage: cart=${storage.has(STORAGE_KEYS.cart)} orders=${storage.has(
        STORAGE_KEYS.orders
      )} favs=${storage.has(STORAGE_KEYS.favorites)}`,
    })
  );
}

function renderInitialRoute() {
  renderRoute(window.location.pathname);
}

async function initApp() {
  bootState.status = "init";
  logBoot();
  const results = await Promise.allSettled([fetchConfig(), loadMenu()]);
  const hasErrors = results.some((result) => result.status === "rejected");
  bootState.status = hasErrors ? "degraded" : "ready";
  bootState.ready = true;
  logBoot();
  logSafeArea();
  setAppHeightVar();
  const configResult = results[0];
  if (configResult.status === "fulfilled") {
    renderBottomContacts(configResult.value);
  } else {
    renderBottomContacts(null);
  }
}

async function main() {
  if (!app) {
    throw new Error("App root element is missing");
  }
  initShell();
  initRoutes();

  const telegramState = initTelegram() ?? { available: false, missingInitData: false };
  warning.hidden = true;

  subscribeCart(() => {
    const itemsCount = count();
    [topBar.nav.buttons, bottomBar.nav.buttons].forEach((buttons) => {
      const cartButton = buttons.find((button) => button.dataset.path === "/cart");
      if (!cartButton) return;
      cartButton.textContent = itemsCount ? `Корзина (${itemsCount})` : "Корзина";
    });
  });

  renderDebug();
  renderInitialRoute();
  syncPendingOrders();
  await initApp();
}

main().catch((error) => {
  console.error("boot:failed", error);
  showBootFailure("Приложение не загрузилось. Попробуйте перезагрузить страницу.", error, "boot");
});

function createContactLink({ label, href, variant = "secondary", icon }) {
  const classes = ["button", "ui-interactive", "button--sm", variant ? `button--${variant}` : "", "bottom-bar-contact"]
    .filter(Boolean)
    .join(" ");
  const attrs = {
    href,
    role: "button",
    "aria-label": label,
    target: href?.startsWith("http") ? "_blank" : undefined,
    rel: href?.startsWith("http") ? "noopener noreferrer" : undefined,
  };
  const link = createElement("a", { className: classes, attrs });
  if (icon) {
    link.appendChild(createElement("span", { className: "contact-icon", text: icon }));
  }
  link.appendChild(createElement("span", { text: label }));
  return link;
}

function normalizeTelegramChatLink(raw) {
  if (!raw) return "";
  if (!isTelegram()) return raw;
  const match = raw.match(/t\.me\/(.+)$/i);
  if (!match) return raw;
  const username = match[1].split("?")[0].replace("@", "");
  return username ? `https://t.me/${username}` : raw;
}

function renderBottomContacts(config) {
  if (!bottomBar?.contacts) return;
  clearElement(bottomBar.contacts);
  const supportPhone = config?.supportPhone || "";
  const supportChat = normalizeTelegramChatLink(config?.supportChat || "");
  const elements = [];
  if (supportPhone) {
    elements.push(
      createContactLink({
        label: "Позвонить",
        href: `tel:${supportPhone.replace(/[^+\d]/g, "")}`,
        icon: "📞",
      })
    );
  }
  if (supportChat) {
    elements.push(
      createContactLink({
        label: "Написать",
        href: supportChat,
        icon: "💬",
      })
    );
  }
  if (!elements.length) {
    bottomBar.contacts.hidden = true;
    return;
  }
  bottomBar.contacts.hidden = false;
  bottomBar.contacts.classList.toggle("is-single", elements.length === 1);
  elements.forEach((el) => bottomBar.contacts.appendChild(el));
}
