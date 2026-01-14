import { createElement, clearElement } from "../ui/dom.js";
import { createButton, setButtonLoading } from "../ui/button.js";
import { formatPrice } from "../services/format.js";
import { PAYMENT_METHODS, preparePayment, applyPromo, getPromoList } from "../services/paymentService.js";
import { sendData, showTelegramAlert, getUser, isTelegram } from "../services/telegramService.js";
import { clear, getState, subscribeCart, total } from "../store/cartStore.js";
import { fetchConfig } from "../services/configService.js";
import { addOrder, addPendingOrder, setLastOrderStatus, storage } from "../services/storageService.js";
import { showToast } from "../ui/toast.js";

const PAYMENT_OPTIONS = [
  { id: PAYMENT_METHODS.cash, label: "Наличные", enabled: true },
  { id: PAYMENT_METHODS.sbp, label: "СБП (QR)", enabled: true },
  { id: PAYMENT_METHODS.card, label: "Карта", enabled: true },
];

function renderOrderItems(container, items) {
  const list = createElement("div", { className: "list" });
  items.forEach((item) => {
    const row = createElement("div", { className: "panel" });
    row.appendChild(createElement("div", { text: item.title }));
    row.appendChild(createElement("div", { className: "helper", text: `${item.qty} × ${formatPrice(item.price)}` }));
    row.appendChild(createElement("div", { className: "helper", text: `Сумма: ${formatPrice(item.price * item.qty)}` }));
    list.appendChild(row);
  });
  clearElement(container);
  container.appendChild(list);
}

export function renderCheckoutPage({ navigate }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);

  let submitting = false;
  let selectedMethod = PAYMENT_METHODS.cash;
  let config = null;
  let promoApplied = null;
  let deliveryType = "delivery";
  let geoData = null;
  let geoConsent = false;
  let geoStatus = "idle";
  let geoError = "";

  const renderState = (state) => {
    clearElement(content);

    if (!state.items.length) {
      const empty = createElement("div", { className: "panel" });
      empty.appendChild(createElement("p", { className: "helper", text: "Корзина пуста. Нечего оформлять." }));
      empty.appendChild(
        createButton({
          label: "Вернуться в меню",
          variant: "secondary",
          onClick: () => navigate("/menu"),
        })
      );
      content.appendChild(empty);
      return;
    }

    const itemsBlock = createElement("div");
    renderOrderItems(itemsBlock, state.items);

    const summary = createElement("div", { className: "panel" });
    const subtotalValue = total();
    const pickupDiscount = deliveryType === "pickup"
      ? Math.round((subtotalValue * Number(config?.promoPickupDiscount || 0)) / 100)
      : 0;
    const discountedSubtotal = Math.max(0, subtotalValue - pickupDiscount);
    const deliveryFee = deliveryType === "delivery" ? Number(config?.deliveryFee || 0) : 0;
    const freeFrom = Number(config?.freeDeliveryFrom || 0);
    const finalDeliveryFee = deliveryFee && subtotalValue >= freeFrom ? 0 : deliveryFee;
    const promoResult = promoApplied
      ? applyPromo(discountedSubtotal, promoApplied)
      : { total: discountedSubtotal, discount: 0 };
    const totalValue = promoResult.total + finalDeliveryFee;

    const subtotalRow = createElement("div", { className: "total-row" });
    subtotalRow.append(
      createElement("span", { text: "Подытог" }),
      createElement("span", { text: formatPrice(subtotalValue) })
    );
    const deliveryRow = createElement("div", { className: "total-row" });
    deliveryRow.append(
      createElement("span", { text: "Доставка" }),
      createElement("span", { text: formatPrice(finalDeliveryFee) })
    );
    const totalRow = createElement("div", { className: "total-row" });
    totalRow.append(createElement("span", { text: "Итого" }), createElement("span", { text: formatPrice(totalValue) }));

    summary.append(subtotalRow);
    if (pickupDiscount) {
      const pickupRow = createElement("div", { className: "total-row" });
      pickupRow.append(
        createElement("span", { text: `Скидка самовывоз` }),
        createElement("span", { text: `−${formatPrice(pickupDiscount)}` })
      );
      summary.appendChild(pickupRow);
    }
    summary.append(deliveryRow);
    if (promoResult.discount) {
      const promoRow = createElement("div", { className: "total-row" });
      promoRow.append(
        createElement("span", { text: `Промокод ${promoApplied.code}` }),
        createElement("span", { text: `−${formatPrice(promoResult.discount)}` })
      );
      summary.appendChild(promoRow);
    }
    summary.appendChild(totalRow);

    const form = createElement("div", { className: "list" });
    const phoneInput = createElement("input", {
      className: "input",
      attrs: { type: "tel", placeholder: "+7 900 000-00-00", required: true },
    });
    const nameInput = createElement("input", {
      className: "input",
      attrs: { type: "text", placeholder: "Имя (необязательно)" },
    });
    const deliveryToggle = createElement("div", { className: "panel" });
    deliveryToggle.appendChild(createElement("div", { className: "helper", text: "Способ получения" }));
    ["delivery", "pickup"].forEach((type) => {
      const label = createElement("label", { className: "panel radio-row" });
      const input = createElement("input", {
        attrs: { type: "radio", name: "delivery", value: type },
      });
      input.checked = deliveryType === type;
      input.addEventListener("change", () => {
        deliveryType = type;
        renderState(getState());
      });
      label.append(
        input,
        createElement("span", {
          text: type === "delivery" ? "Доставка" : "Самовывоз",
        })
      );
      deliveryToggle.appendChild(label);
    });

    const addressInput = createElement("input", {
      className: "input",
      attrs: { type: "text", placeholder: "Адрес доставки" },
    });
    const postalEnabled = Boolean(config?.deliveryPostalEnabled);
    const geoEnabled = Boolean(config?.deliveryGeoEnabled);
    const deliveryZoneId = Number.isFinite(Number(config?.defaultDeliveryZoneId))
      ? Number(config?.defaultDeliveryZoneId)
      : null;
    const postalInput = createElement("input", {
      className: "input",
      attrs: { type: "text", placeholder: "Индекс" },
    });
    const postalHint = createElement("div", {
      className: "helper",
      text: "Индекс нужен для проверки зоны доставки.",
    });

    const geoConsentToggle = createElement("label", { className: "panel radio-row" });
    const geoConsentInput = createElement("input", {
      attrs: { type: "checkbox" },
    });
    geoConsentInput.checked = geoConsent;
    geoConsentInput.addEventListener("change", () => {
      geoConsent = geoConsentInput.checked;
    });
    geoConsentToggle.append(
      geoConsentInput,
      createElement("span", { text: "Разрешаю определить местоположение" })
    );
    const geoStatusText = createElement("div", {
      className: "helper",
      text:
        geoStatus === "ready" && geoData
          ? `Местоположение определено: ${geoData.lat.toFixed(5)}, ${geoData.lng.toFixed(5)}`
          : geoStatus === "loading"
            ? "Определяем местоположение..."
            : geoStatus === "error"
              ? geoError || "Не удалось определить местоположение."
              : "Геолокация используется только для проверки зоны доставки.",
    });
    const geoButton = createButton({
      label: "Определить местоположение",
      variant: "secondary",
      onClick: () => {
        if (!geoConsent) {
          geoError = "Подтвердите согласие на использование геолокации.";
          geoStatus = "error";
          geoStatusText.textContent = geoError;
          showToast(geoError, "info");
          return;
        }
        if (!navigator?.geolocation) {
          geoError = "Геолокация недоступна в этом браузере.";
          geoStatus = "error";
          geoStatusText.textContent = geoError;
          showToast(geoError, "error");
          return;
        }
        setButtonLoading(geoButton, true);
        geoStatus = "loading";
        geoStatusText.textContent = "Определяем местоположение...";
        navigator.geolocation.getCurrentPosition(
          (position) => {
            geoData = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            geoError = "";
            geoStatus = "ready";
            geoStatusText.textContent = `Местоположение определено: ${geoData.lat.toFixed(5)}, ${geoData.lng.toFixed(5)}`;
            setButtonLoading(geoButton, false);
            showToast("Местоположение определено", "success");
          },
          (geoErr) => {
            geoData = null;
            geoStatus = "error";
            geoError = geoErr?.message || "Не удалось определить местоположение.";
            geoStatusText.textContent = geoError;
            setButtonLoading(geoButton, false);
            showToast(geoError, "error");
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      },
    });

    const commentLabel = createElement("label", { className: "helper", text: "Комментарий к заказу" });
    const commentInput = createElement("textarea", {
      className: "input",
      attrs: { placeholder: "Например: без лука, курьер позвонить" },
    });

    const paymentLabel = createElement("div", { className: "helper", text: "Способ оплаты" });
    const paymentOptions = createElement("div", { className: "list" });
    PAYMENT_OPTIONS.forEach((option) => {
      const optionRow = createElement("label", { className: "panel" });
      const input = createElement("input", {
        attrs: {
          type: "radio",
          name: "payment",
          value: option.id,
          disabled: option.enabled ? undefined : "disabled",
        },
      });
      input.checked = option.id === selectedMethod;
      input.addEventListener("change", () => {
        selectedMethod = option.id;
      });
      optionRow.append(input, createElement("span", { text: option.label }));
      if (!option.enabled) {
        optionRow.appendChild(createElement("span", { className: "helper", text: "Скоро" }));
      }
      paymentOptions.appendChild(optionRow);
    });

    const promoLabel = createElement("label", { className: "helper", text: "Промокод" });
    const promoInput = createElement("input", {
      className: "input",
      attrs: { type: "text", placeholder: "Введите промокод" },
    });
    const promoButton = createButton({
      label: "Применить",
      variant: "secondary",
      onClick: () => {
        const code = promoInput.value.trim().toLowerCase();
        if (!code) {
          showToast("Введите промокод", "info");
          return;
        }
        const promoList = getPromoList(storage);
        const promo = promoList.find((item) => item.code?.toLowerCase() === code && item.active);
        if (!promo) {
          showToast("Промокод не найден", "error");
          promoApplied = null;
        } else {
          promoApplied = promo;
          showToast("Промокод применен", "success");
        }
        renderState(getState());
      },
    });

    const error = createElement("div", { className: "error" });
    error.hidden = true;

    const submit = createButton({
      label: "Оформить заказ",
      onClick: async () => {
        if (submitting) return;
        error.hidden = true;

        if (!getState().items.length) {
          error.textContent = "Корзина пуста.";
          error.hidden = false;
          return;
        }

        const phone = phoneInput.value.trim();
        if (!/^\+?[0-9\s()-]{10,}$/.test(phone)) {
          error.textContent = "Введите корректный телефон.";
          error.hidden = false;
          return;
        }
        if (deliveryType === "delivery" && !addressInput.value.trim()) {
          error.textContent = "Адрес обязателен для доставки.";
          error.hidden = false;
          return;
        }
        const postalCode = postalInput.value.trim();
        const hasGeo =
          geoData &&
          Number.isFinite(geoData.lat) &&
          Number.isFinite(geoData.lng);
        if (deliveryType === "delivery" && postalEnabled && !postalCode) {
          error.textContent = "Укажите индекс, чтобы проверить зону доставки.";
          error.hidden = false;
          return;
        }
        if (deliveryType === "delivery" && geoEnabled && !hasGeo) {
          error.textContent = "Нужно определить местоположение для проверки зоны доставки.";
          error.hidden = false;
          return;
        }
        if (deliveryType === "delivery" && Array.isArray(config?.deliveryZones) && config.deliveryZones.length) {
          const address = addressInput.value.trim().toLowerCase();
          const match = config.deliveryZones.some((zone) => address.includes(String(zone).toLowerCase()));
          if (!match) {
            showToast("Адрес вне зоны доставки. Заказ может быть отклонен.", "info");
          }
        }
        if (subtotalValue < Number(config?.minOrder || 0)) {
          error.textContent = `Минимальная сумма заказа ${formatPrice(config?.minOrder || 0)}.`;
          error.hidden = false;
          return;
        }
        const now = new Date();
        const [openHour, openMin] = String(config?.workHours?.open || "10:00").split(":").map(Number);
        const [closeHour, closeMin] = String(config?.workHours?.close || "22:00").split(":").map(Number);
        const minutes = now.getHours() * 60 + now.getMinutes();
        const openMinutes = openHour * 60 + openMin;
        const closeMinutes = closeHour * 60 + closeMin;
        if (minutes < openMinutes || minutes > closeMinutes) {
          error.textContent = `Мы работаем с ${config?.workHours?.open} до ${config?.workHours?.close}.`;
          error.hidden = false;
          return;
        }

        submitting = true;
        setButtonLoading(submit, true);

        const orderId = window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const user = getUser();
        const order = {
          type: "pizza_order_v1",
          order_id: orderId,
          request_id: null,
          ts: Math.floor(Date.now() / 1000),
          source: "webapp",
          user: {
            tg_id: user?.id,
            username: user?.username,
            first_name: user?.first_name,
          },
          customer: { phone, name: nameInput.value.trim() || undefined },
          delivery: {
            type: deliveryType,
            address: deliveryType === "delivery" ? addressInput.value.trim() : undefined,
            postalCode: deliveryType === "delivery" ? postalCode || undefined : undefined,
            geo: deliveryType === "delivery" && hasGeo ? { ...geoData } : undefined,
            zoneId: deliveryType === "delivery" ? deliveryZoneId || undefined : undefined,
          },
          payment: { method: selectedMethod, status: "pending" },
          items: state.items.map((item) => ({
            id: item.id,
            title: item.title,
            price: item.price,
            qty: item.qty,
          })),
          subtotal: discountedSubtotal,
          delivery_fee: finalDeliveryFee,
          total: totalValue,
          comment: commentInput.value.trim(),
        };

        try {
          const payment = await preparePayment(order, selectedMethod);
          order.payment = payment;
          if (payment.status === "failed") {
            const status = "order:pending_sync";
            addOrder({ ...order, status });
            setLastOrderStatus({
              status,
              order_id: order.order_id,
              request_id: order.request_id || undefined,
            });
            error.textContent = payment.message || "Не удалось создать платеж. Заказ сохранён локально.";
            error.hidden = false;
            showToast(error.textContent, "error");
            navigate("/order-status");
            return;
          }
          const apiPayload = {
            order_id: order.order_id,
            customerName: order.customer.name || "Гость",
            phone: order.customer.phone,
            address: order.delivery.address,
            comment: order.comment,
            payment_id: order.payment.payment_id,
            payment_status: order.payment.status,
            payment_method: order.payment.method,
            deliveryZoneId: deliveryType === "delivery" ? deliveryZoneId || null : null,
            postalCode: deliveryType === "delivery" ? postalCode || null : null,
            geo: deliveryType === "delivery" && hasGeo ? { ...geoData } : null,
            items: order.items.map((item) => ({
              ...item,
              id: Number(item.id),
            })),
            total: order.total,
          };
          let pendingSync = false;
          try {
            const apiResponse = await fetch("/api/public/orders", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(apiPayload),
            });
            const requestId = apiResponse.headers.get("x-request-id");
            if (requestId) {
              order.request_id = requestId;
            }
            let apiErrorPayload = null;
            if (!apiResponse.ok) {
              try {
                apiErrorPayload = await apiResponse.json();
              } catch (parseError) {
                apiErrorPayload = null;
              }
              const apiReason = apiErrorPayload?.error?.details?.reason;
              const apiMessage = apiErrorPayload?.error?.message;
              if (apiReason === "delivery_zone_mismatch") {
                const message = apiMessage || "Адрес вне зоны доставки.";
                error.textContent = message;
                error.hidden = false;
                showToast(message, "error");
                return;
              }
              pendingSync = true;
              throw new Error(apiMessage || `API status ${apiResponse.status}`);
            }
          } catch (apiError) {
            pendingSync = true;
            addPendingOrder({
              order_id: order.order_id,
              payload: apiPayload,
              ts: Date.now(),
              request_id: order.request_id || undefined,
            });
            console.warn("Failed to persist order in API", apiError);
          }
          setLastOrderStatus({
            status: "order:creating",
            order_id: order.order_id,
            request_id: order.request_id || undefined,
          });
          const sent = sendData(order);
          if (!sent && !isTelegram()) {
            const status = pendingSync ? "order:pending_sync" : "order:sent";
            addOrder({ ...order, status });
            setLastOrderStatus({
              status,
              order_id: order.order_id,
              request_id: order.request_id || undefined,
            });
            clear();
            showToast("Заказ сохранён локально", "success");
            navigate("/order-status");
            return;
          }
          const status = sent ? (pendingSync ? "order:pending_sync" : "order:sent") : "order:error";
          setLastOrderStatus({
            status,
            order_id: order.order_id,
            request_id: order.request_id || undefined,
          });
          if (!sent) {
            throw new Error("Telegram unavailable");
          }
          addOrder({ ...order, status });
          clear();
          showTelegramAlert("Заказ отправлен в бот ✅");
          showToast("Заказ принят, мы скоро свяжемся!", "success");
          if (order.payment?.confirmation?.type === "redirect" && order.payment?.payment_url) {
            window.location.assign(order.payment.payment_url);
            return;
          }
          navigate("/order-status");
        } catch (err) {
          console.error("Checkout failed", err);
          setLastOrderStatus({
            status: "order:error",
            order_id: order.order_id,
            request_id: order.request_id || undefined,
          });
          addOrder({ ...order, status: "order:error" });
          error.textContent = "Не удалось отправить заказ. Сохранено локально.";
          error.hidden = false;
          showToast("Ошибка Telegram — заказ сохранён локально", "error");
          navigate("/order-status");
        } finally {
          submitting = false;
          setButtonLoading(submit, false);
        }
      },
    });

    form.append(
      createElement("label", { className: "helper", text: "Телефон" }),
      phoneInput,
      createElement("label", { className: "helper", text: "Имя" }),
      nameInput,
      deliveryToggle
    );
    if (deliveryType === "delivery") {
      form.append(createElement("label", { className: "helper", text: "Адрес" }), addressInput);
      if (postalEnabled) {
        form.append(
          createElement("label", { className: "helper", text: "Индекс" }),
          postalInput,
          postalHint
        );
      }
      if (geoEnabled) {
        form.append(
          createElement("label", { className: "helper", text: "Местоположение" }),
          geoConsentToggle,
          geoButton,
          geoStatusText
        );
      }
    }

    summary.append(
      form,
      commentLabel,
      commentInput,
      paymentLabel,
      paymentOptions,
      promoLabel,
      promoInput,
      promoButton,
      error,
      submit
    );
    content.append(itemsBlock, summary);
  };

  const unsubscribe = subscribeCart(renderState);
  fetchConfig().then((configValue) => {
    config = configValue;
    renderState(getState());
  });
  return { element: root, cleanup: unsubscribe };
}
