#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

python - <<'PY'
from pathlib import Path

p = Path("webapp/pages/profilePage.js")
s = p.read_text(encoding="utf-8")

# 1) Показывать auth-панель когда нет user (и в Telegram тоже)
old = "if (!user && !isMiniApp) {"
new = "if (!user) {"
if old in s:
    s = s.replace(old, new, 1)
else:
    # если условие уже меняли или формат другой — пытаемся мягко
    import re
    s2, n = re.subn(r"if\s*\(\s*!user\s*&&\s*!isMiniApp\s*\)\s*\{", "if (!user) {", s, count=1)
    if n == 0:
        print("WARN: не нашёл `if (!user && !isMiniApp) {` — возможно уже исправлено.")
    else:
        s = s2

# 2) Добавим кнопку сброса авторизации в authPanel (рядом с Email действиями)
# Ищем строку: emailActions.append(loginButton, registerButton, resetButton);
marker = "emailActions.append(loginButton, registerButton, resetButton);"
if marker in s and "Сбросить авторизацию" not in s:
    insert = """\
      const clearSessionButton = createButton({
        label: "Сбросить авторизацию",
        variant: "ghost",
        onClick: () => {
          try { clearAuthState(); } catch {}
          try {
            localStorage.removeItem("auth:token");
            localStorage.removeItem("auth:user");
            localStorage.removeItem("auth:provider");
          } catch {}
          showToast("Сессия очищена", "success");
          render();
        },
      });
"""
    s = s.replace(marker, insert + "\n      " + marker, 1)

    # И добавим кнопку в append, если уже вставили clearSessionButton
    s = s.replace(
        "emailActions.append(loginButton, registerButton, resetButton);",
        "emailActions.append(loginButton, registerButton, resetButton, clearSessionButton);",
        1
    )

p.write_text(s, encoding="utf-8")
print("OK: profilePage.js patched (login panel visible + reset auth button)")
PY

echo "Done. Now commit & push:"
echo "  git add webapp/pages/profilePage.js"
echo "  git commit -m \"fix(auth): always show login panel and add reset auth button\""
echo "  git push"
