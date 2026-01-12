import { createElement } from "./dom.js";

export function createQuantityStepper({
  value,
  min = 1,
  max = 99,
  onDecrement,
  onIncrement,
} = {}) {
  const container = createElement("div", { className: "qty-stepper" });
  const dec = createElement("button", {
    className: "qty-button ui-control",
    text: "−",
    attrs: { type: "button", "aria-label": "Уменьшить" },
  });
  const label = createElement("span", { className: "qty-label", text: String(value) });
  const inc = createElement("button", {
    className: "qty-button ui-control",
    text: "+",
    attrs: { type: "button", "aria-label": "Увеличить" },
  });

  const setDisabled = () => {
    dec.disabled = value <= min;
    inc.disabled = value >= max;
    dec.classList.toggle("is-disabled", dec.disabled);
    inc.classList.toggle("is-disabled", inc.disabled);
  };

  dec.addEventListener("click", () => {
    if (value <= min) return;
    onDecrement?.();
  });

  inc.addEventListener("click", () => {
    if (value >= max) return;
    onIncrement?.();
  });

  setDisabled();
  container.append(dec, label, inc);
  return container;
}
