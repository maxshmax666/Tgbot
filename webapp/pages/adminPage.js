import { createElement } from "../ui/dom.js";

export function renderAdminPage() {
  const root = createElement("section", { className: "min-h-screen" });
  const mount = createElement("div");
  root.appendChild(mount);

  let cleanup = null;
  import("../admin/AdminApp.js").then((module) => {
    cleanup = module.mountAdminApp(mount);
  });

  return {
    element: root,
    cleanup: () => cleanup?.(),
  };
}
