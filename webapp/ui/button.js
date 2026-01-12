import { createElement } from "./dom.js";

const VARIANT_CLASS_MAP = {
  primary: "",
  secondary: "button--secondary",
  ghost: "button--ghost",
  nav: "button--nav",
  chip: "button--chip",
  icon: "button--icon",
  qty: "button--qty",
};

const SIZE_CLASS_MAP = {
  sm: "button--sm",
  md: "button--md",
  lg: "button--lg",
};

export function createButton({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  onClick,
  ariaLabel,
  pressed,
  current,
  href,
  type = "button",
  className = "",
} = {}) {
  const variantClass = VARIANT_CLASS_MAP[variant] ?? "";
  const sizeClass = SIZE_CLASS_MAP[size] ?? "";
  const classes = ["button", "ui-interactive", variantClass, sizeClass, className].filter(Boolean).join(" ");
  const isLink = typeof href === "string";

  const button = createElement(isLink ? "a" : "button", {
    className: classes,
    text: label,
    attrs: {
      type: isLink ? undefined : type,
      href: isLink && !disabled && !loading ? href : undefined,
    },
  });

  if (ariaLabel) {
    button.setAttribute("aria-label", ariaLabel);
  }

  if (typeof pressed === "boolean") {
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
  }

  if (typeof current === "boolean") {
    if (current) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  }

  if (isLink) {
    if (disabled || loading) {
      button.setAttribute("aria-disabled", "true");
      button.dataset.disabled = "true";
      button.tabIndex = -1;
    }
  } else {
    button.disabled = disabled || loading;
  }

  if (loading) {
    button.dataset.state = "loading";
    button.dataset.label = label;
    button.textContent = "Загрузка…";
    button.setAttribute("aria-busy", "true");
  }

  if (onClick) {
    button.addEventListener("click", (event) => {
      if (button.dataset.disabled === "true" || button.dataset.state === "loading") {
        event.preventDefault();
        return;
      }
      onClick(event);
    });
  }

  return button;
}

export function setButtonPressed(button, pressed) {
  if (!button || typeof pressed !== "boolean") return;
  button.setAttribute("aria-pressed", pressed ? "true" : "false");
}

export function setButtonCurrent(button, current) {
  if (!button || typeof current !== "boolean") return;
  if (current) {
    button.setAttribute("aria-current", "page");
  } else {
    button.removeAttribute("aria-current");
  }
}

export function setButtonLoading(button, loading) {
  if (!button) return;
  if (loading) {
    button.dataset.label = button.textContent;
    button.textContent = "Загрузка…";
    button.dataset.state = "loading";
    button.setAttribute("aria-busy", "true");
    if ("disabled" in button) button.disabled = true;
    button.dataset.disabled = "true";
  } else {
    const label = button.dataset.label;
    if (label) button.textContent = label;
    button.classList.remove("loading");
    delete button.dataset.state;
    button.removeAttribute("aria-busy");
    if ("disabled" in button) button.disabled = false;
    delete button.dataset.disabled;
  }
}
