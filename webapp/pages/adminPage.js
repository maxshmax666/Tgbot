import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { fetchConfig, resetConfigCache } from "../services/configService.js";
import { STORAGE_KEYS, storage, getOrders } from "../services/storageService.js";
import { sendData, getUser, showTelegramPopup, showTelegramAlert } from "../services/telegramService.js";
import { showToast } from "../ui/toast.js";

async function sha256(input) {
  if (!window.crypto?.subtle) {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function confirmAction(message, onConfirm) {
  showTelegramPopup(
    {
      title: "Подтвердите",
      message,
      buttons: [
        { id: "cancel", type: "cancel", text: "Отмена" },
        { id: "ok", type: "ok", text: "Подтвердить" },
      ],
    },
    (id) => {
      if (id === "ok") onConfirm();
    }
  );
}

function downloadFile(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getMenuFromStorage() {
  const cached = storage.read(STORAGE_KEYS.adminMenu, null);
  if (cached?.items) return cached.items;
  return [];
}

export function renderAdminPage() {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);

  let orderSearch = "";

  const renderLogin = async () => {
    clearElement(content);
    const panel = createElement("div", { className: "panel" });
    panel.appendChild(createElement("h2", { className: "title", text: "Админ-доступ" }));
    panel.appendChild(createElement("p", { className: "helper", text: "Войдите через PIN-код." }));
    const pinInput = createElement("input", {
      className: "input",
      attrs: { type: "password", placeholder: "PIN-код" },
    });
    const loginButton = createButton({
      label: "Войти",
      onClick: async () => {
        const config = await fetchConfig();
        const pinHash = config.adminPinHash;
        if (!pinHash) {
          showToast("PIN не настроен", "error");
          return;
        }
        const enteredHash = await sha256(pinInput.value.trim());
        if (enteredHash === pinHash) {
          sessionStorage.setItem(STORAGE_KEYS.adminAuth, "true");
          showToast("Доступ открыт", "success");
          renderAdmin();
        } else {
          showToast("Неверный PIN", "error");
        }
      },
    });
    panel.append(pinInput, loginButton);
    content.appendChild(panel);
  };

  const renderAdmin = async () => {
    clearElement(content);
    const config = await fetchConfig();

    const user = getUser();
    if (config.adminTgId && user?.id && Number(config.adminTgId) === Number(user.id)) {
      sessionStorage.setItem(STORAGE_KEYS.adminAuth, "true");
    }
    if (!sessionStorage.getItem(STORAGE_KEYS.adminAuth)) {
      await renderLogin();
      return;
    }

    const title = createElement("h2", { className: "title", text: "Админка" });

    const menuPanel = createElement("div", { className: "panel" });
    menuPanel.appendChild(createElement("h3", { className: "section-title", text: "Меню" }));
    const menuList = createElement("div", { className: "list" });
    const menuItems = getMenuFromStorage();
    menuItems.forEach((item, index) => {
      const row = createElement("div", { className: "admin-row" });
      row.appendChild(createElement("div", { text: `${item.title} • ${item.price} ₽` }));
      const edit = createButton({
        label: "Редактировать",
        variant: "secondary",
        onClick: () =>
          confirmAction("Сохранить изменения?", () => {
            const title = prompt("Название", item.title);
            const price = prompt("Цена", item.price);
            if (!title || !price) return;
            menuItems[index] = { ...item, title, price: Number(price) };
            storage.write(STORAGE_KEYS.adminMenu, { items: menuItems });
            showToast("Позиция обновлена", "success");
            renderAdmin();
          }),
      });
      const remove = createButton({
        label: "Удалить",
        variant: "ghost",
        onClick: () =>
          confirmAction("Удалить позицию?", () => {
            menuItems.splice(index, 1);
            storage.write(STORAGE_KEYS.adminMenu, { items: menuItems });
            showToast("Позиция удалена", "info");
            renderAdmin();
          }),
      });
      row.append(edit, remove);
      menuList.appendChild(row);
    });
    if (!menuItems.length) {
      menuList.appendChild(createElement("p", { className: "helper", text: "Меню пусто." }));
    }
    const addButton = createButton({
      label: "Добавить пиццу",
      onClick: () =>
        confirmAction("Добавить новую пиццу?", () => {
          const title = prompt("Название");
          const slug = prompt("Slug (латиницей)");
          const price = Number(prompt("Цена", "0"));
          const desc = prompt("Описание", "");
          const photosCount = Number(prompt("Кол-во фото", "1"));
          if (!title || !slug || !price) return;
          menuItems.push({
            id: slug,
            slug,
            title,
            price,
            desc,
            photosCount,
            tags: [],
            isAvailable: true,
          });
          storage.write(STORAGE_KEYS.adminMenu, { items: menuItems });
          showToast("Позиция добавлена", "success");
          renderAdmin();
        }),
    });
    const exportButton = createButton({
      label: "Экспорт JSON",
      variant: "secondary",
      onClick: () => downloadFile("menu.json", JSON.stringify(menuItems, null, 2), "application/json"),
    });
    const importButton = createButton({
      label: "Импорт JSON",
      variant: "secondary",
      onClick: () =>
        confirmAction("Импорт перезапишет меню. Продолжить?", () => {
          const raw = prompt("Вставьте JSON");
          if (!raw) return;
          try {
            const items = JSON.parse(raw);
            storage.write(STORAGE_KEYS.adminMenu, { items });
            showToast("Меню импортировано", "success");
            renderAdmin();
          } catch (error) {
            showToast("Некорректный JSON", "error");
          }
        }),
    });
    const syncButton = createButton({
      label: "Синхронизировать с ботом",
      variant: "secondary",
      onClick: () =>
        confirmAction("Отправить меню в бот?", () => {
          const sent = sendData({ type: "admin_menu_update_v1", items: menuItems, ts: Date.now() });
          if (sent) {
            showTelegramAlert("Меню отправлено в бот");
          } else {
            showToast("Telegram недоступен", "error");
          }
        }),
    });

    menuPanel.append(menuList, addButton, exportButton, importButton, syncButton);

    const ordersPanel = createElement("div", { className: "panel" });
    ordersPanel.appendChild(createElement("h3", { className: "section-title", text: "Заказы" }));
    const orders = getOrders();
    const searchInput = createElement("input", {
      className: "input",
      attrs: { type: "search", placeholder: "Поиск по телефону или номеру заказа" },
    });
    searchInput.value = orderSearch;
    const ordersList = createElement("div", { className: "list" });
    const filteredOrders = orders.filter((order) => {
      const query = orderSearch.trim().toLowerCase();
      if (!query) return true;
      return (
        String(order.order_id || "").toLowerCase().includes(query) ||
        String(order.customer?.phone || "").toLowerCase().includes(query)
      );
    });
    searchInput.addEventListener("input", (event) => {
      orderSearch = event.target.value;
      renderAdmin();
    });
    filteredOrders.slice(0, 50).forEach((order) => {
      const row = createElement("div", { className: "admin-row" });
      row.appendChild(createElement("div", { text: `#${order.order_id} • ${order.total} ₽` }));
      const status = createElement("select", { className: "input" });
      ["new", "accepted", "cooking", "on_the_way", "done", "canceled"].forEach((value) => {
        const option = createElement("option", { attrs: { value }, text: value });
        if (order.status === value) option.selected = true;
        status.appendChild(option);
      });
      status.addEventListener("change", () =>
        confirmAction("Обновить статус заказа?", () => {
          order.status = status.value;
          storage.write(STORAGE_KEYS.orders, orders);
          sendData({ type: "admin_order_status_v1", order_id: order.order_id, status: order.status });
          showToast("Статус обновлен", "success");
        })
      );
      row.appendChild(status);
      ordersList.appendChild(row);
    });
    if (!orders.length) {
      ordersList.appendChild(createElement("p", { className: "helper", text: "Заказов пока нет." }));
    }
    const exportOrders = createButton({
      label: "Экспорт CSV",
      variant: "secondary",
      onClick: () => {
        const rows = ["order_id,total,status,phone"];
        orders.forEach((order) => {
          rows.push(
            `${order.order_id || ""},${order.total || 0},${order.status || ""},${order.customer?.phone || ""}`
          );
        });
        downloadFile("orders.csv", rows.join("\n"), "text/csv");
      },
    });
    ordersPanel.append(searchInput, ordersList, exportOrders);

    const settingsPanel = createElement("div", { className: "panel" });
    settingsPanel.appendChild(createElement("h3", { className: "section-title", text: "Настройки" }));
    const minOrderInput = createElement("input", {
      className: "input",
      attrs: { type: "number", value: config.minOrder || 0 },
    });
    const workOpen = createElement("input", {
      className: "input",
      attrs: { type: "time", value: config.workHours?.open || "10:00" },
    });
    const workClose = createElement("input", {
      className: "input",
      attrs: { type: "time", value: config.workHours?.close || "22:00" },
    });
    const deliveryFeeInput = createElement("input", {
      className: "input",
      attrs: { type: "number", value: config.deliveryFee || 0 },
    });
    const freeFromInput = createElement("input", {
      className: "input",
      attrs: { type: "number", value: config.freeDeliveryFrom || 0 },
    });
    const zonesInput = createElement("textarea", {
      className: "input",
      attrs: { placeholder: "Зоны доставки, по одной на строку" },
    });
    zonesInput.value = Array.isArray(config.deliveryZones) ? config.deliveryZones.join("\n") : "";
    const bannerInput = createElement("input", {
      className: "input",
      attrs: { type: "text", value: config.bannerText || "" },
    });
    const supportPhoneInput = createElement("input", {
      className: "input",
      attrs: { type: "text", value: config.supportPhone || "" },
    });
    const supportChatInput = createElement("input", {
      className: "input",
      attrs: { type: "text", value: config.supportChat || "" },
    });
    const saveSettings = createButton({
      label: "Сохранить настройки",
      onClick: () =>
        confirmAction("Сохранить настройки?", () => {
          const updated = {
            minOrder: Number(minOrderInput.value || 0),
            workHours: { open: workOpen.value, close: workClose.value },
            deliveryFee: Number(deliveryFeeInput.value || 0),
            freeDeliveryFrom: Number(freeFromInput.value || 0),
            bannerText: bannerInput.value,
            supportPhone: supportPhoneInput.value,
            supportChat: supportChatInput.value,
            deliveryZones: zonesInput.value
              .split("\n")
              .map((value) => value.trim())
              .filter(Boolean),
          };
          storage.write(STORAGE_KEYS.adminConfig, updated);
          resetConfigCache();
          sendData({ type: "admin_config_update_v1", config: updated, ts: Date.now() });
          showToast("Настройки сохранены", "success");
        }),
    });
    const exportConfig = createButton({
      label: "Экспорт JSON",
      variant: "secondary",
      onClick: () =>
        downloadFile("config.json", JSON.stringify(config, null, 2), "application/json"),
    });
    settingsPanel.append(
      createElement("label", { className: "helper", text: "Минимальный заказ" }),
      minOrderInput,
      createElement("label", { className: "helper", text: "Открытие" }),
      workOpen,
      createElement("label", { className: "helper", text: "Закрытие" }),
      workClose,
      createElement("label", { className: "helper", text: "Стоимость доставки" }),
      deliveryFeeInput,
      createElement("label", { className: "helper", text: "Бесплатная доставка от" }),
      freeFromInput,
      createElement("label", { className: "helper", text: "Зоны доставки" }),
      zonesInput,
      createElement("label", { className: "helper", text: "Текст баннера" }),
      bannerInput,
      createElement("label", { className: "helper", text: "Телефон" }),
      supportPhoneInput,
      createElement("label", { className: "helper", text: "Чат поддержки" }),
      supportChatInput,
      saveSettings,
      exportConfig
    );

    const promoPanel = createElement("div", { className: "panel" });
    promoPanel.appendChild(createElement("h3", { className: "section-title", text: "Промокоды" }));
    const promoList = storage.read(STORAGE_KEYS.adminPromos, []);
    const promoItems = createElement("div", { className: "list" });
    promoList.forEach((promo, index) => {
      const row = createElement("div", { className: "admin-row" });
      row.appendChild(
        createElement("div", {
          text: `${promo.code} • ${promo.type} • ${promo.value}${promo.expiresAt ? ` • до ${promo.expiresAt}` : ""}`,
        })
      );
      const toggle = createButton({
        label: promo.active ? "Выключить" : "Включить",
        variant: "secondary",
        onClick: () => {
          promo.active = !promo.active;
          storage.write(STORAGE_KEYS.adminPromos, promoList);
          showToast("Промокод обновлен", "success");
          renderAdmin();
        },
      });
      const remove = createButton({
        label: "Удалить",
        variant: "ghost",
        onClick: () =>
          confirmAction("Удалить промокод?", () => {
            promoList.splice(index, 1);
            storage.write(STORAGE_KEYS.adminPromos, promoList);
            renderAdmin();
          }),
      });
      row.append(toggle, remove);
      promoItems.appendChild(row);
    });
    const addPromo = createButton({
      label: "Добавить промокод",
      onClick: () =>
        confirmAction("Добавить промокод?", () => {
          const code = prompt("Код");
          const type = prompt("Тип (percent|fixed)", "percent");
          const value = Number(prompt("Значение", "0"));
          const expiresAt = prompt("Срок действия (YYYY-MM-DD)", "");
          if (!code || !type || !value) return;
          promoList.push({
            code,
            type: type === "fixed" ? "fixed" : "percent",
            value,
            active: true,
            expiresAt: expiresAt || null,
          });
          storage.write(STORAGE_KEYS.adminPromos, promoList);
          renderAdmin();
        }),
    });
    promoPanel.append(promoItems, addPromo);

    content.append(title, menuPanel, ordersPanel, settingsPanel, promoPanel);
  };

  renderAdmin();
  return { element: root };
}
