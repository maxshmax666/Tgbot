import { createButton } from "./button.js";

export function createIconButton({
  icon,
  active = false,
  ariaLabel,
  className = "",
  ...buttonProps
} = {}) {
  const button = createButton({
    ...buttonProps,
    label: icon,
    variant: buttonProps.variant || "icon",
    ariaLabel,
  });
  button.classList.add("icon-button");
  if (className) {
    className.split(" ").filter(Boolean).forEach((name) => button.classList.add(name));
  }
  if (active) {
    button.classList.add("is-active");
    button.setAttribute("aria-pressed", "true");
  } else if (ariaLabel) {
    button.setAttribute("aria-pressed", "false");
  }
  return button;
}
