import { createElement } from "../ui/dom.js";
import { showToast } from "../ui/toast.js";

export function renderVerifyEmailPage() {
  const root = createElement("section", { className: "list" });
  const panel = createElement("div", { className: "panel" });
  panel.appendChild(createElement("h2", { className: "title", text: "Подтверждение email" }));
  const status = createElement("p", { className: "helper", text: "Проверяем ссылку…" });
  panel.appendChild(status);
  root.appendChild(panel);

  const token = new URLSearchParams(window.location.search).get("token") || "";
  if (!token) {
    status.textContent = "Токен не найден.";
    return { element: root };
  }

  fetch("/api/public/auth/email-verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error?.message || "Не удалось подтвердить email";
        throw new Error(message);
      }
      status.textContent = "Email подтверждён. Можно входить.";
      showToast("Email подтверждён", "success");
    })
    .catch((error) => {
      status.textContent = error?.message || "Не удалось подтвердить email";
      showToast(status.textContent, "error");
    });

  return { element: root };
}
