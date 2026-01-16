import { createElement } from "./dom.js";

let container = null;

function ensureContainer() {
  if (container) return container;
  container = createElement("div", {
    className: "toast-container",
    attrs: {
      role: "status",
      "aria-live": "polite",
    },
  });
  document.body.appendChild(container);
  return container;
}

export function showToast(message, variant = "info") {
  const options =
    typeof variant === "string"
      ? { variant }
      : {
          variant: variant?.variant || "info",
          durationMs: variant?.durationMs,
          actionLabel: variant?.actionLabel,
          onAction: variant?.onAction,
        };
  const root = ensureContainer();
  const toast = createElement("div", { className: ["toast", options.variant].join(" ") });
  if (options.variant === "error") {
    toast.setAttribute("aria-live", "assertive");
  }
  const text = createElement("span", { className: "toast-text", text: message });
  toast.appendChild(text);
  if (options.actionLabel && typeof options.onAction === "function") {
    const action = createElement("button", {
      className: "toast-action",
      text: options.actionLabel,
      attrs: { type: "button" },
    });
    action.addEventListener("click", () => options.onAction());
    toast.appendChild(action);
  }
  root.appendChild(toast);
  window.setTimeout(() => toast.classList.add("show"), 10);
  const duration = Number.isFinite(options.durationMs) ? options.durationMs : 2200;
  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 200);
  }, duration);
}
