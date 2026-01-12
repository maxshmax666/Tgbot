import { createElement } from "./dom.js";

export function createCard({
  variant = "panel",
  className = "",
  as = "div",
  clickable = false,
} = {}) {
  const baseClass = variant === "card" ? "card" : "panel";
  const element = createElement(as, {
    className: ["ui-card", baseClass, clickable ? "clickable" : "", className]
      .filter(Boolean)
      .join(" "),
  });
  return element;
}
