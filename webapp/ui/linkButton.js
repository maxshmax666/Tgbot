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

export function createLinkButton({
  label,
  href,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  onClick,
  ariaLabel,
  pressed,
  current,
  rel,
  target,
  className = "",
} = {}) {
  const variantClass = VARIANT_CLASS_MAP[variant] ?? "";
  const sizeClass = SIZE_CLASS_MAP[size] ?? "";
  const classes = ["button", "ui-interactive", variantClass, sizeClass, className]
    .filter(Boolean)
    .join(" ");

  const link = createElement("a", {
    className: classes,
    text: label,
    attrs: {
      href: !disabled && !loading ? href : undefined,
      rel,
      target,
    },
  });

  if (ariaLabel) {
    link.setAttribute("aria-label", ariaLabel);
  }

  if (typeof pressed === "boolean") {
    link.setAttribute("aria-pressed", pressed ? "true" : "false");
  }

  if (typeof current === "boolean") {
    if (current) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }

  if (disabled || loading) {
    link.setAttribute("aria-disabled", "true");
    link.dataset.disabled = "true";
    link.tabIndex = -1;
  }

  if (loading) {
    link.dataset.state = "loading";
    link.dataset.label = label;
    link.textContent = "Загрузка…";
    link.setAttribute("aria-busy", "true");
  }

  link.addEventListener("click", (event) => {
    if (link.dataset.disabled === "true" || link.dataset.state === "loading") {
      event.preventDefault();
      return;
    }

    if (onClick) {
      onClick(event);
    }
  });

  return link;
}
