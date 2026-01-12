import { createElement } from "./dom.js";
import { createNavBar } from "./topBar.js";

export function createBottomBar({ navItems, onNavigate } = {}) {
  const wrapper = createElement("div", { className: "bottom-bar" });
  const { nav, buttons } = createNavBar({ navItems, onNavigate, className: "nav--bottom" });
  wrapper.appendChild(nav);
  return { element: wrapper, nav, buttons };
}
