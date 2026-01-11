import { initTelegram } from "./services/telegramService.js";
import { getCartCount, subscribeCart } from "./store/cartStore.js";
import { renderMenuPage } from "./pages/menuPage.js";
import { renderCartPage } from "./pages/cartPage.js";
import { renderCheckoutPage } from "./pages/checkoutPage.js";
import { renderPizzaPage } from "./pages/pizzaPage.js";
import { createElement, clearElement } from "./ui/dom.js";

const app = document.getElementById("app");

const header = createElement("header", { className: "header" });
header.appendChild(createElement("h1", { className: "title", text: "Pizza Tagil" }));
header.appendChild(
  createElement("p", {
    className: "subtitle",
    text: "Мини App для заказа пиццы без лишних шагов.",
  })
);

const warning = createElement("div", { className: "warning", text: "Открой внутри Telegram" });
warning.hidden = true;

const nav = createElement("nav", { className: "nav" });
const navButtons = [
  { label: "Меню", path: "/menu" },
  { label: "Корзина", path: "/cart" },
  { label: "Оформить", path: "/checkout" },
].map((item) => {
  const button = createElement("button", {
    className: "nav-button",
    text: item.label,
    attrs: { type: "button", "data-path": item.path },
  });
  nav.appendChild(button);
  return button;
});

const content = createElement("main");

app.append(header, warning, nav, content);

const routes = [
  { path: /^\/menu\/?$/, render: renderMenuPage },
  { path: /^\/cart\/?$/, render: renderCartPage },
  { path: /^\/checkout\/?$/, render: renderCheckoutPage },
  { path: /^\/pizza\/([^/]+)\/?$/, render: renderPizzaPage },
];

let cleanup = null;

function setActiveNav(pathname) {
  navButtons.forEach((button) => {
    const target = button.dataset.path;
    button.classList.toggle("active", pathname.startsWith(target));
  });
}

function renderRoute(pathname) {
  const path = pathname === "/" ? "/menu" : pathname;
  const match = routes.find((route) => route.path.test(path));
  if (!match) {
    navigate("/menu");
    return;
  }

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

nav.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-path]");
  if (!button) return;
  navigate(button.dataset.path);
});

window.addEventListener("popstate", () => renderRoute(window.location.pathname));

const telegramState = initTelegram();
warning.hidden = telegramState.available;

subscribeCart(() => {
  const count = getCartCount();
  const cartButton = navButtons[1];
  cartButton.textContent = count ? `Корзина (${count})` : "Корзина";
});

renderRoute(window.location.pathname);
