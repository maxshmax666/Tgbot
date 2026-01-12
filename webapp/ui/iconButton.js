import { createButton } from "./button.js";

export function createIconButton({
  icon,
  active = false,
  pressed,
  ariaLabel,
  className = "",
  ...buttonProps
} = {}) {
  const isPressed = typeof pressed === "boolean" ? pressed : active;
  const button = createButton({
    ...buttonProps,
    label: icon,
    variant: buttonProps.variant || "icon",
    ariaLabel,
    pressed: isPressed,
  });
  button.classList.add("icon-button");
  if (className) {
    className.split(" ").filter(Boolean).forEach((name) => button.classList.add(name));
  }
  if (isPressed) {
    button.classList.add("is-active");
  }
  return button;
}
