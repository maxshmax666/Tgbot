import { createElement } from "../ui/dom.js";

export function renderAdminPage() {
  const root = createElement("section", { className: "min-h-screen" });
  const mount = createElement("div");
  const placeholder = createElement("div", {
    className: "admin-placeholder",
    text: "Загрузка админки…",
  });
  root.appendChild(placeholder);
  root.appendChild(mount);

  let cleanup = null;
  import("../admin/AdminApp.js")
    .then((module) => {
      placeholder.remove();
      cleanup = module.mountAdminApp(mount, {
        navigate: window.appNavigate,
        initialPath: window.location.pathname,
      });
    })
    .catch((error) => {
      placeholder.textContent = `Ошибка загрузки админки: ${error.message}`;
    });

  return {
    element: root,
    cleanup: () => cleanup?.(),
  };
}
