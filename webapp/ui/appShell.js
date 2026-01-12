import { createElement } from "./dom.js";
import { createTopBar } from "./topBar.js";
import { createBottomBar } from "./bottomBar.js";

export function createAppShell({ title, subtitle, navItems, onNavigate } = {}) {
  const shell = createElement("div", { className: "app-shell" });
  const content = createElement("main", { className: "app-shell__content" });

  const warning = createElement("div", {
    className: "warning",
    text: "Browser Mode: Telegram WebApp недоступен.",
  });
  warning.hidden = true;

  const debugPanel = createElement("div", { className: "panel debug-panel" });
  debugPanel.hidden = true;

  const topBar = createTopBar({ title, subtitle, navItems, onNavigate });
  const bottomBar = createBottomBar({ navItems, onNavigate });

  shell.append(topBar.element, warning, debugPanel, content, bottomBar.element);

  return {
    element: shell,
    content,
    warning,
    debugPanel,
    topNav: topBar.nav,
    bottomNav: bottomBar.nav,
    topButtons: topBar.buttons,
    bottomButtons: bottomBar.buttons,
    header: topBar.header,
    topBar: topBar.element,
    bottomBar: bottomBar.element,
  };
}
