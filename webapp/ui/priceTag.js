import { createElement } from "./dom.js";

export function createPriceTag({ value, className = "" } = {}) {
  return createElement("div", {
    className: ["price-tag", className].filter(Boolean).join(" "),
    text: value ?? "",
  });
}
