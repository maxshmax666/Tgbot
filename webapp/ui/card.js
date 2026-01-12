import { createElement } from "./dom.js";

export function createCard({ className = "", interactive = false, attrs = {} } = {}) {
  const classes = [
    "card",
    interactive ? "card--interactive" : "",
    interactive ? "ui-interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const card = createElement("article", { className: classes, attrs });
  if (interactive && !card.hasAttribute("tabindex")) {
    card.setAttribute("tabindex", "0");
  }
  return card;
}

export function createCardHeader({ className = "", attrs = {} } = {}) {
  return createElement("div", { className: ["card-header", className].filter(Boolean).join(" "), attrs });
}

export function createCardFooter({ className = "", attrs = {} } = {}) {
  return createElement("div", { className: ["card-footer", className].filter(Boolean).join(" "), attrs });
}
