import { createElement } from "./dom.js";
import { createButton } from "./button.js";

function createNav({ items, onNavigate, location = "top" }) {
  const nav = createElement("nav", {
    className: "nav",
    attrs: { "aria-label": location === "top" ? "Основная навигация" : "Нижняя навигация" },
  });
  const buttons = items.map((item) => {
    const button = createButton({
      label: item.label,
      variant: "nav",
      size: "sm",
      ariaLabel: item.label,
      onClick: () => onNavigate(item.path),
    });
    button.dataset.path = item.path;
    button.dataset.location = location;
    nav.appendChild(button);
    return button;
  });
  return { element: nav, buttons };
}

export function createTopBar({ title, subtitle, navItems, onNavigate }) {
  const header = createElement("header", { className: "header" });
  header.appendChild(createElement("h1", { className: "title", text: title }));
  header.appendChild(createElement("p", { className: "subtitle", text: subtitle }));

  const nav = createNav({ items: navItems, onNavigate, location: "top" });

  const element = createElement("div", { className: "top-bar" });
  element.append(header, nav.element);

  return { element, header, nav };
}

export function createBottomBar({ navItems, onNavigate }) {
  const nav = createNav({ items: navItems, onNavigate, location: "bottom" });
  const element = createElement("div", { className: "bottom-bar" });
  element.appendChild(nav.element);
  return { element, nav };
}

export function createAppShell({ title, subtitle, navItems, onNavigate }) {
  const warning = createElement("div", { className: "warning", text: "Browser Mode: Telegram WebApp недоступен." });
  warning.hidden = true;

  const debugPanel = createElement("div", { className: "panel debug-panel" });
  debugPanel.hidden = true;

  const topBar = createTopBar({ title, subtitle, navItems, onNavigate });
  const bottomBar = createBottomBar({ navItems, onNavigate });
  const content = createElement("main", { className: "app-content" });

  return {
    elements: [topBar.element, warning, debugPanel, content, bottomBar.element],
    warning,
    debugPanel,
    topBar,
    bottomBar,
    content,
  };
}
