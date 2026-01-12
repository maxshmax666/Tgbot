import { createElement } from "./dom.js";

export function createButton({
  label,
  variant = "primary",
  type = "button",
  onClick,
  disabled = false,
  loading = false,
} = {}) {
  const button = createElement("button", {
    className: [
      "button",
      "ui-button",
      "ui-control",
      variant !== "primary" ? variant : "",
    ]
      .filter(Boolean)
      .join(" "),
    text: label,
    attrs: { type },
  });
  button.disabled = disabled || loading;
  if (disabled) {
    button.classList.add("is-disabled");
  }
  if (loading) {
    button.classList.add("loading", "is-loading");
    button.dataset.label = label;
    button.textContent = "Загрузка…";
  }
  if (onClick) {
    button.addEventListener("click", onClick);
  }
  return button;
}

export function setButtonLoading(button, loading) {
  if (!button) return;
  if (loading) {
    button.dataset.label = button.textContent;
    button.textContent = "Загрузка…";
    button.classList.add("loading", "is-loading");
    button.classList.remove("is-disabled");
    button.disabled = true;
  } else {
    const label = button.dataset.label;
    if (label) button.textContent = label;
    button.classList.remove("loading", "is-loading");
    button.disabled = false;
    button.classList.remove("is-disabled");
  }
}
