import { STORAGE_KEYS, storage } from "./storageService.js";

let cachedConfig = null;

const DEFAULT_CONFIG = {
  minOrder: 700,
  workHours: { open: "10:00", close: "22:00" },
  workSchedule: [
    {
      days: [1, 2, 3, 4, 5, 6, 0],
      intervals: [{ start: "10:00", end: "22:00" }],
    },
  ],
  deliveryFee: 0,
  freeDeliveryFrom: 1500,
  supportPhone: "+7 (900) 000-00-00",
  supportChat: "https://t.me/pizzatagil_support",
  bannerText: "Горячая пицца и любимые хиты каждый день",
  adminPinHash: null,
  adminTgId: null,
  promoPickupDiscount: 10,
  deliveryZones: [],
  deliveryGeoEnabled: false,
  deliveryPostalEnabled: false,
  defaultDeliveryZoneId: null,
};

export async function fetchConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    const response = await fetch("/data/config.json", { cache: "no-store" });
    if (response.ok) {
      cachedConfig = { ...DEFAULT_CONFIG, ...(await response.json()) };
    } else {
      cachedConfig = { ...DEFAULT_CONFIG };
    }
  } catch (error) {
    cachedConfig = { ...DEFAULT_CONFIG };
  }

  const override = storage.read(STORAGE_KEYS.adminConfig, null);
  if (override && typeof override === "object") {
    cachedConfig = { ...cachedConfig, ...override };
  }
  return cachedConfig;
}

export function resetConfigCache() {
  cachedConfig = null;
}
