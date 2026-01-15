import { createElement } from "../ui/dom.js";
import { adminApi } from "../services/adminApi.js";

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
  const path = window.location.pathname;
  const isLoginRoute = path.startsWith("/admin/login");

  const boot = async () => {
    if (!isLoginRoute) {
      try {
        await adminApi.me();
      } catch (err) {
        placeholder.textContent = "Нет доступа к админке. Перенаправляем на вход…";
        window.appNavigate?.("/admin/login");
        return;
      }
    }
    import("/admin/AdminApp.bundle.js")
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
  };

  boot();

  return {
    element: root,
    cleanup: () => cleanup?.(),
  };
}
