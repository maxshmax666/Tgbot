import { createElement } from "./dom.js";

export function createNavBar({ navItems, onNavigate, className = "" } = {}) {
  const nav = createElement("nav", { className: ["nav", className].filter(Boolean).join(" ") });
  const buttons = navItems.map((item) => {
    const button = createElement("button", {
      className: "nav-button ui-control",
      text: item.label,
      attrs: { type: "button", "data-path": item.path },
    });
    nav.appendChild(button);
    return button;
  });
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-path]");
    if (!button) return;
    onNavigate?.(button.dataset.path);
  });
  return { nav, buttons };
}

export function createTopBar({ title, subtitle, navItems, onNavigate } = {}) {
  const wrapper = createElement("div", { className: "top-bar" });
  const header = createElement("header", { className: "header" });
  header.appendChild(createElement("h1", { className: "title", text: title }));
  header.appendChild(createElement("p", { className: "subtitle", text: subtitle }));

  const { nav, buttons } = createNavBar({ navItems, onNavigate, className: "nav--top" });
  wrapper.append(header, nav);
  return { element: wrapper, nav, buttons, header };
}
