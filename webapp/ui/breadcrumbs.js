import { createElement } from "./dom.js";

export function createBreadcrumbs(items = []) {
  const nav = createElement("nav", { className: "breadcrumbs", attrs: { "aria-label": "Хлебные крошки" } });
  const list = createElement("ol", { className: "breadcrumbs-list" });

  items.forEach((item, index) => {
    const li = createElement("li", { className: "breadcrumbs-item" });
    if (item?.onClick) {
      const button = createElement("button", {
        className: "breadcrumbs-link",
        text: item.label,
        attrs: { type: "button" },
      });
      button.addEventListener("click", item.onClick);
      li.appendChild(button);
    } else {
      li.appendChild(createElement("span", { className: "breadcrumbs-current", text: item?.label || "" }));
    }
    if (index < items.length - 1) {
      li.appendChild(createElement("span", { className: "breadcrumbs-separator", text: "→" }));
    }
    list.appendChild(li);
  });

  nav.appendChild(list);
  return nav;
}
