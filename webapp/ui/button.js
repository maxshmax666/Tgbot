import { createElement } from "./dom.js";

export function createButton({ label, variant = "primary", type = "button", onClick, disabled = false } = {}) {
  const button = createElement("button", {
    className: ["button", variant !== "primary" ? variant : ""].filter(Boolean).join(" "),
    text: label,
    attrs: { type },
  });
  button.disabled = disabled;
  if (onClick) {
    button.addEventListener("click", onClick);
  }
  return button;
}
