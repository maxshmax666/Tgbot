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
import { getLastOrderStatus, storage, STORAGE_KEYS } from "./services/storageService.js";
import { syncPendingOrders } from "./services/orderSyncService.js";
import { IntroOverlay, getIntroState, shouldShowIntro } from "./ui/introMatrixPizzaOverlay.js";
import { checkHealth } from "./services/healthService.js";
import { hasLocalMenu } from "./services/menuService.js";
import { loadLocalMenu, loadMenu } from "./store/menuStore.js";
import { fetchConfig } from "./services/configService.js";

const app = document.getElementById("app");

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
const appShell = createAppShell({
  title: "Пиццерия Тагил",
  subtitle: "Мини‑приложение для заказа пиццы без лишних шагов.",
  navItems,
  onNavigate: (path) => navigate(path),
});
const { warning, debugPanel, topBar, bottomBar, content } = appShell;

app.append(...appShell.elements);

const routes = [
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
  { path: /^\/pizza\/([^/]+)\/?$/, render: renderPizzaPage },
  { path: /^\/page\/([^/]+)\/?$/, render: renderDynamicPage },
];

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

  const paramsMatch = path.match(match.path);
  const params = paramsMatch && paramsMatch.length > 1 ? { id: paramsMatch[1] } : {};
  const result = match.render({ navigate, params });
  cleanup = result?.cleanup || null;
  content.appendChild(result.element);
  setActiveNav(path);
  if (typeof result?.restoreScroll === "function") {
    result.restoreScroll();
  }
}

function navigate(path) {
  window.history.pushState({}, "", path);
  renderRoute(path);
}

window.appNavigate = navigate;

window.addEventListener("popstate", () => renderRoute(window.location.pathname));
window.addEventListener("online", () => {
  syncPendingOrders();
});
window.addEventListener("resize", setAppHeightVar);
window.addEventListener("orientationchange", setAppHeightVar);
setAppHeightVar();

const telegramState = initTelegram();
warning.textContent =
  "Откройте через кнопку «🍕 Открыть магазин» в боте, иначе Telegram функции недоступны.";
warning.hidden = telegramState.available && !telegramState.missingInitData;

subscribeCart(() => {
  const itemsCount = count();
  [topBar.nav.buttons, bottomBar.nav.buttons].forEach((buttons) => {
    const cartButton = buttons.find((button) => button.dataset.path === "/cart");
    if (!cartButton) return;
    cartButton.textContent = itemsCount ? `Корзина (${itemsCount})` : "Корзина";
  });
});

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

renderDebug();

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

renderInitialRoute();
syncPendingOrders();
void initApp();

let overlayController = null;

function cleanupOverlay() {
  if (overlayController?.cleanup) {
    overlayController.cleanup();
    overlayController = null;
  }
}

async function runHealthCheck() {
  console.info("health-check:start");
  const result = await checkHealth({ timeoutMs: 2500 });
  console.info("health-check:result", {
    ok: result.ok,
    status: result.status,
    timedOut: result.timedOut,
    error: result.error?.message || null,
  });
  return result;
}

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
  const match = raw.match(/t\\.me\\/(.+)$/i);
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
        href: `tel:${supportPhone.replace(/[^+\\d]/g, "")}`,
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

async function resolveOverlayMode() {
  const { forceIntro, seen } = getIntroState();
  const healthResult = await runHealthCheck();
  const maintenance = !healthResult.ok;
  const showIntro = shouldShowIntro();
  const showMode = maintenance ? "maintenance" : showIntro ? "intro" : "none";
  console.info("intro:decision", { forceIntro, seen, maintenance, showMode });
  return { maintenance, showMode };
}

async function showOverlayFlow() {
  const { maintenance, showMode } = await resolveOverlayMode();
  cleanupOverlay();
  if (showMode === "none") return;
  if (showMode === "maintenance") {
    const allowOffline = await hasLocalMenu();
    overlayController = IntroOverlay({
      mode: "maintenance",
      allowOffline,
      onRetry: () => {
        showOverlayFlow();
      },
      onOpenOffline: async () => {
        try {
          await loadLocalMenu();
          cleanupOverlay();
          navigate("/menu");
        } catch (error) {
          console.warn("Offline menu load failed", error);
        }
      },
    });
    return;
  }
  overlayController = IntroOverlay({
    mode: "intro",
    onDismiss: () => {
      cleanupOverlay();
    },
  });
}

showOverlayFlow();
