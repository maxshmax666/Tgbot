import { createElement } from "./dom.js";

export function createChip({
  label,
  active = false,
  onClick,
  variant = "filter",
  className = "",
} = {}) {
  const isButton = variant !== "tag";
  const element = createElement(isButton ? "button" : "span", {
    className: [
      "chip",
      `chip--${variant}`,
      active ? "active" : "",
      isButton ? "ui-control" : "",
      className,
    ]
      .filter(Boolean)
      .join(" "),
    text: label,
    attrs: isButton ? { type: "button" } : undefined,
  });
  if (isButton && onClick) {
    element.addEventListener("click", onClick);
  }
  return element;
}
