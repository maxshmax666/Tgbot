import { createButton } from "./button.js";

export function createChip({ label, active = false, onClick, disabled = false, ariaLabel } = {}) {
  const chip = createButton({
    label,
    variant: "chip",
    size: "sm",
    onClick,
    disabled,
    ariaLabel: ariaLabel || label,
    pressed: active,
  });
  if (active) {
    chip.classList.add("is-active");
  }
  return chip;
}
