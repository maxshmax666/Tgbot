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
    className: ["button", variant !== "primary" ? variant : ""].filter(Boolean).join(" "),
    text: label,
    attrs: { type },
  });
  button.disabled = disabled || loading;
  if (loading) {
    button.classList.add("loading");
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
    button.classList.add("loading");
    button.disabled = true;
  } else {
    const label = button.dataset.label;
    if (label) button.textContent = label;
    button.classList.remove("loading");
    button.disabled = false;
  }
}
