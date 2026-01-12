import { createButton } from "./button.js";

export function createChip({ label, active = false, onClick, disabled = false, ariaLabel } = {}) {
  const chip = createButton({
    label,
    variant: "chip",
    size: "sm",
    onClick,
    disabled,
    ariaLabel: ariaLabel || label,
  });
  if (active) {
    chip.classList.add("is-active");
    chip.setAttribute("aria-pressed", "true");
  } else {
    chip.setAttribute("aria-pressed", "false");
  }
  return chip;
}
