const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Failed to parse storage value", error);
    return fallback;
  }
};

export const STORAGE_KEYS = {
  cart: "pt_cart_v1",
  orders: "pt_orders_v1",
  favorites: "pt_favs_v1",
  adminAuth: "pt_admin_auth_v1",
  adminMenu: "pt_admin_menu_v1",
  adminConfig: "pt_admin_config_v1",
  adminPromos: "pt_admin_promos_v1",
  lastOrderStatus: "pt_last_order_status_v1",
};

export const storage = {
  read(key, fallback) {
    try {
      return safeParse(localStorage.getItem(key), fallback);
    } catch (error) {
      console.warn("Storage read failed", error);
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Storage write failed", error);
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn("Storage remove failed", error);
    }
  },
  has(key) {
    try {
      return localStorage.getItem(key) !== null;
    } catch (error) {
      return false;
    }
  },
};

export function getOrders() {
  const items = storage.read(STORAGE_KEYS.orders, []);
  return Array.isArray(items) ? items : [];
}

export function addOrder(order) {
  const items = getOrders();
  items.unshift(order);
  storage.write(STORAGE_KEYS.orders, items.slice(0, 50));
}

export function getFavorites() {
  const raw = storage.read(STORAGE_KEYS.favorites, []);
  return new Set(Array.isArray(raw) ? raw.map(String) : []);
}

export function setFavorites(favorites) {
  storage.write(STORAGE_KEYS.favorites, Array.from(favorites));
}

export function setLastOrderStatus(status) {
  storage.write(STORAGE_KEYS.lastOrderStatus, status);
}

export function getLastOrderStatus() {
  return storage.read(STORAGE_KEYS.lastOrderStatus, null);
}
