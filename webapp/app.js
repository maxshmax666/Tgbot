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
import { createAppShell } from "./ui/appShell.js";

const app = document.getElementById("app");

const navItems = [
  { label: "Меню", path: "/menu" },
  { label: "Корзина", path: "/cart" },
  { label: "Оформить", path: "/checkout" },
  { label: "Профиль", path: "/profile" },
  { label: "Админ", path: "/admin" },
];

const shell = createAppShell({
  title: "Pizza Tagil",
  subtitle: "Мини App для заказа пиццы без лишних шагов.",
  navItems,
  onNavigate: (path) => navigate(path),
});

app.appendChild(shell.element);

const routes = [
  { path: /^\/menu\/?$/, render: renderMenuPage },
  { path: /^\/cart\/?$/, render: renderCartPage },
  { path: /^\/checkout\/?$/, render: renderCheckoutPage },
  { path: /^\/profile\/?$/, render: renderProfilePage },
  { path: /^\/admin\/login\/?$/, render: renderAdminPage },
  { path: /^\/admin\/?$/, render: renderAdminPage },
  { path: /^\/order-status\/?$/, render: renderOrderStatusPage },
  { path: /^\/pizza\/([^/]+)\/?$/, render: renderPizzaPage },
  { path: /^\/page\/([^/]+)\/?$/, render: renderDynamicPage },
];

let cleanup = null;

function setActiveNav(pathname) {
  [shell.topButtons, shell.bottomButtons].forEach((buttons) => {
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
  shell.topBar.hidden = isAdmin;
  shell.bottomBar.hidden = isAdmin;
  document.body.classList.toggle("admin-mode", isAdmin);

  renderDebug();
  if (cleanup) cleanup();
  clearElement(shell.content);

  const paramsMatch = path.match(match.path);
  const params = paramsMatch && paramsMatch.length > 1 ? { id: paramsMatch[1] } : {};
  const result = match.render({ navigate, params });
  cleanup = result?.cleanup || null;
  shell.content.appendChild(result.element);
  setActiveNav(path);
}

function navigate(path) {
  window.history.pushState({}, "", path);
  renderRoute(path);
}

window.appNavigate = navigate;

window.addEventListener("popstate", () => renderRoute(window.location.pathname));

const telegramState = initTelegram();
shell.warning.hidden = telegramState.available;

subscribeCart(() => {
  const itemsCount = count();
  [shell.topButtons, shell.bottomButtons].forEach((buttons) => {
    const cartButton = buttons[1];
    cartButton.textContent = itemsCount ? `Корзина (${itemsCount})` : "Корзина";
  });
});

function renderDebug() {
  const isDebug = new URLSearchParams(window.location.search).get("debug") === "1";
  shell.debugPanel.hidden = !isDebug;
  if (!isDebug) return;
  clearElement(shell.debugPanel);
  const lastStatus = getLastOrderStatus();
  shell.debugPanel.appendChild(createElement("h3", { className: "section-title", text: "Debug" }));
  shell.debugPanel.appendChild(createElement("div", { className: "helper", text: `isTelegram: ${isTelegram()}` }));
  const user = getUser();
  shell.debugPanel.appendChild(
    createElement("div", {
      className: "helper",
      text: `user: ${user?.id || "—"} ${user?.username ? `@${user.username}` : ""}`,
    })
  );
  shell.debugPanel.appendChild(
    createElement("div", {
      className: "helper",
      text: `lastOrderStatus: ${lastStatus?.status || "—"}`,
    })
  );
  shell.debugPanel.appendChild(
    createElement("div", {
      className: "helper",
      text: `cart items: ${count()}`,
    })
  );
  shell.debugPanel.appendChild(
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
