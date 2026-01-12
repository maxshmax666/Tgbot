import { createElement } from "./dom.js";

export function createInput({
  type = "text",
  placeholder = "",
  value = "",
  disabled = false,
  ariaLabel,
  onInput,
  onChange,
  className = "",
  attrs = {},
} = {}) {
  const input = createElement("input", {
    className: ["input", "ui-interactive", className].filter(Boolean).join(" "),
    attrs: {
      type,
      placeholder,
      ...attrs,
    },
  });
  input.value = value;
  if (ariaLabel) {
    input.setAttribute("aria-label", ariaLabel);
  }
  if (disabled) {
    input.disabled = true;
    input.dataset.disabled = "true";
  }
  if (onInput) input.addEventListener("input", onInput);
  if (onChange) input.addEventListener("change", onChange);
  return input;
}
