import { createElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { confirmPasswordReset } from "../services/authService.js";
import { showToast } from "../ui/toast.js";

export function renderResetPasswordPage() {
  const root = createElement("section", { className: "list" });
  const panel = createElement("div", { className: "panel" });
  panel.appendChild(createElement("h2", { className: "title", text: "Сброс пароля" }));

  const token = new URLSearchParams(window.location.search).get("token") || "";
  if (!token) {
    panel.appendChild(createElement("p", { className: "helper", text: "Токен не найден." }));
    root.appendChild(panel);
    return { element: root };
  }

  const passwordInput = createElement("input", {
    className: "input",
    attrs: { type: "password", placeholder: "Новый пароль (мин. 8 символов)" },
  });
  const button = createButton({
    label: "Сохранить",
    onClick: async () => {
      const password = passwordInput.value;
      if (!password || password.length < 8) {
        showToast("Пароль должен быть не короче 8 символов", "info");
        return;
      }
      try {
        await confirmPasswordReset({ token, password });
        showToast("Пароль обновлён", "success");
      } catch (error) {
        showToast(error?.message || "Не удалось сбросить пароль", "error");
      }
    },
  });

  panel.append(passwordInput, button);
  root.appendChild(panel);

  return { element: root };
}
