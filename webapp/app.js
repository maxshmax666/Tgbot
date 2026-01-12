import { initTelegram, isTelegram, getUser } from "./services/telegramService.js";
import { count, subscribeCart } from "./store/cartStore.js";
import { renderMenuPage } from "./pages/menuPage.js";
import { renderCartPage } from "./pages/cartPage.js";
import { renderCheckoutPage } from "./pages/checkoutPage.js";
import { renderPizzaPage } from "./pages/pizzaPage.js";
import { renderProfilePage } from "./pages/profilePage.js";
import { renderAdminPage } from "./pages/adminPage.js";
import { renderOrderStatusPage } from "./pages/orderStatusPage.js";
import { renderDynamicPage } from "./pages/dynamicPage.js";
import { createElement, clearElement } from "./ui/dom.js";
import { getLastOrderStatus, storage, STORAGE_KEYS } from "./services/storageService.js";

const app = document.getElementById("app");

const header = createElement("header", { className: "header" });
header.appendChild(createElement("h1", { className: "title", text: "Pizza Tagil" }));
header.appendChild(
  createElement("p", {
    className: "subtitle",
    text: "Мини App для заказа пиццы без лишних шагов.",
  })
);

const warning = createElement("div", { className: "warning", text: "Browser Mode: Telegram WebApp недоступен." });
warning.hidden = true;

const debugPanel = createElement("div", { className: "panel debug-panel" });
debugPanel.hidden = true;

const navItems = [
  { label: "Меню", path: "/menu" },
  { label: "Корзина", path: "/cart" },
  { label: "Оформить", path: "/checkout" },
  { label: "Профиль", path: "/profile" },
  { label: "Админ", path: "/admin" },
];

function createNav() {
  const nav = createElement("nav", { className: "nav" });
  const buttons = navItems.map((item) => {
    const button = createElement("button", {
      className: "nav-button",
      text: item.label,
      attrs: { type: "button", "data-path": item.path },
    });
    nav.appendChild(button);
    return button;
  });
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-path]");
    if (!button) return;
    navigate(button.dataset.path);
  });
  return { nav, buttons };
}

const topNav = createNav();
const bottomNav = createNav();

const content = createElement("main");

app.append(header, warning, debugPanel, topNav.nav, content, bottomNav.nav);

const routes = [
  { path: /^\/menu\/?$/, render: renderMenuPage },
  { path: /^\/cart\/?$/, render: renderCartPage },
  { path: /^\/checkout\/?$/, render: renderCheckoutPage },
  { path: /^\/profile\/?$/, render: renderProfilePage },
  { path: /^\/admin\/?$/, render: renderAdminPage },
  { path: /^\/order-status\/?$/, render: renderOrderStatusPage },
  { path: /^\/pizza\/([^/]+)\/?$/, render: renderPizzaPage },
  { path: /^\/page\/([^/]+)\/?$/, render: renderDynamicPage },
];

let cleanup = null;

function setActiveNav(pathname) {
  [topNav.buttons, bottomNav.buttons].forEach((buttons) => {
    buttons.forEach((button) => {
      const target = button.dataset.path;
      button.classList.toggle("active", pathname.startsWith(target));
    });
  });
}

function renderRoute(pathname) {
  const path = pathname === "/" ? "/menu" : pathname;
  const match = routes.find((route) => route.path.test(path));
  if (!match) {
    navigate("/menu");
    return;
  }

  const isAdmin = path.startsWith("/admin");
  header.hidden = isAdmin;
  topNav.nav.hidden = isAdmin;
  bottomNav.nav.hidden = isAdmin;
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

window.addEventListener("popstate", () => renderRoute(window.location.pathname));

const telegramState = initTelegram();
warning.hidden = telegramState.available;

subscribeCart(() => {
  const itemsCount = count();
  [topNav.buttons, bottomNav.buttons].forEach((buttons) => {
    const cartButton = buttons[1];
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
renderRoute(window.location.pathname);
