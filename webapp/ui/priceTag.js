import { createElement } from "./dom.js";

export function createPriceTag({ text, className = "" } = {}) {
  return createElement("div", {
    className: ["price-tag", className].filter(Boolean).join(" "),
    text,
  });
}
