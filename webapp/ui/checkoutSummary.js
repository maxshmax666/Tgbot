import { createElement } from "./dom.js";
import { createCard } from "./card.js";

export function createCheckoutSummary({ rows = [], children = [] } = {}) {
  const summary = createCard({ variant: "panel", className: "checkout-summary" });
  rows.forEach((row) => {
    const rowEl = createElement("div", { className: "total-row" });
    rowEl.append(createElement("span", { text: row.label }), createElement("span", { text: row.value }));
    summary.appendChild(rowEl);
  });
  children.forEach((child) => summary.appendChild(child));
  return summary;
}
