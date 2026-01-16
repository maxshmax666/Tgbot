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
  { label: "Главная", path: "/home" },
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

function logBoot(route) {
  console.info(`[boot] route=${route} ready=${bootState.ready} status=${bootState.status}`);
}

function logTabSwitch(path) {
  const target = navItems.find((item) => path.startsWith(item.path));
  if (!target || target.path === lastTab) return;
  lastTab = target.path;
  console.info(`[tab] switch to ${target.path.replace("/", "")}`);
}

function logSafeArea() {
  const styles = getComputedStyle(document.documentElement);
  const topInset = parseFloat(styles.getPropertyValue("--safe-area-top")) || 0;
  const bottomInset = parseFloat(styles.getPropertyValue("--safe-area-bottom")) || 0;
  console.info(`[layout] safeArea top=${topInset} bottom=${bottomInset} applied`);
}

function setActiveNav(pathname) {
  [topBar.nav.buttons, bottomBar.nav.buttons].forEach((buttons) => {
    buttons.forEach((button) => {
      const target = button.dataset.path;
      const isActive = pathname.startsWith(target);
      button.classList.toggle("is-active", isActive);
      setButtonCurrent(button, isActive);
    });
  });
}

function renderRoute(pathname) {
  const path = pathname === "/" ? "/home" : pathname;
  const match = routes.find((route) => route.path.test(path));
  if (!match) {
    navigate("/menu");
    return;
  }

  logBoot(path);
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
  logBoot(window.location.pathname);
  const results = await Promise.allSettled([fetchConfig(), loadMenu()]);
  const hasErrors = results.some((result) => result.status === "rejected");
  bootState.status = hasErrors ? "degraded" : "ready";
  bootState.ready = true;
  logBoot(window.location.pathname);
  logSafeArea();
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
