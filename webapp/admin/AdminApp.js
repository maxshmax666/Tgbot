import React, { useCallback, useEffect, useMemo, useState } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "https://esm.sh/@dnd-kit/core@6.1.0";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "https://esm.sh/@dnd-kit/sortable@8.0.0";
import { CSS } from "https://esm.sh/@dnd-kit/utilities@3.2.2";
import { adminApi } from "../services/adminApi.js";
import { resolveMediaUrl } from "../services/mediaBase.js";
import { confirmPopup } from "../services/telegramService.js";

const RU = {
  nav: {
    dashboard: "Обзор",
    products: "Товары",
    categories: "Категории",
    ingredients: "Ингредиенты",
    inventory: "Склад",
    orders: "Заказы",
    media: "Медиа",
    pages: "Страницы",
  },
  blocks: {
    hero: "Первый экран",
    banner: "Баннер",
    text: "Текст",
    gallery: "Галерея",
    productsGrid: "Сетка товаров",
  },
  buttons: {
    retry: "Повторить",
    signIn: "Войти",
    signingIn: "Входим…",
    create: "Создать",
    save: "Сохранить",
    delete: "Удалить",
    edit: "Редактировать",
    upload: "Загрузить",
    use: "Выбрать",
    close: "Закрыть",
    addUrl: "Добавить URL",
    addIngredient: "Добавить ингредиент",
    remove: "Удалить",
    reset: "Сбросить",
    logout: "Выйти",
    viewPublicPage: "Открыть публичную страницу",
  },
  labels: {
    password: "Пароль",
    email: "Email",
    title: "Название",
    sort: "Сортировка",
    active: "Активность",
    statusActive: "Активен",
    statusInactive: "Неактивен",
    yes: "Да",
    no: "Нет",
    description: "Описание",
    price: "Цена",
    category: "Категория",
    featured: "Рекомендуемый",
    images: "Изображения",
    imagesComma: "Изображения (URL через запятую)",
    content: "Контент",
    buttonLabel: "Текст кнопки",
    buttonLink: "Ссылка кнопки",
    subtitle: "Подзаголовок",
    text: "Текст",
    slug: "Slug",
    ingredient: "Ингредиент",
    ingredients: "Состав (граммы)",
    qtyGrams: "Граммы на пиццу",
    unit: "Ед.",
    available: "Остаток (г)",
  },
  headings: {
    adminLogin: "Вход в админку",
    ingredients: "Ингредиенты",
    inventory: "Склад и остатки",
    newCategory: "Новая категория",
    categories: "Категории",
    mediaLibrary: "Медиатека",
    productEditor: "Редактор товара",
    products: "Товары",
    orders: "Заказы",
    orderDetails: "Заказ",
    newPage: "Новая страница",
    pages: "Страницы",
    pageBuilder: "Конструктор страницы",
    dashboard: "Добро пожаловать",
    adminPanel: "Админ-панель",
    blocks: "Блоки",
    canvas: "Полотно",
    properties: "Свойства",
  },
  messages: {
    adminLoginHint: "Введите email владельца и пароль.",
    adminPasswordInfoPrefix: "Owner создаётся через ENV",
    adminPasswordInfoSuffix: "(локально). Минимум 8 символов.",
    envCheckFailed: "Не удалось проверить переменные окружения.",
    missingEnv: "Не заданы переменные окружения:",
    envNotConfiguredPrefix: "ENV не настроены",
    loginFailed: "Не удалось войти.",
    loginErrorFallback: "Не удалось авторизоваться. Проверьте пароль и настройки API.",
    healthCheckFailed: (status) => `Проверка конфигурации не удалась (${status}).`,
    loading: "Загрузка…",
    loadingAdminConfig: "Проверяем конфигурацию админки…",
    loadingAdminAccess: "Проверяем доступ к админке…",
    errorLoadingAdmin: "Ошибка загрузки админки",
    errorLoadingUi: "Произошла ошибка в интерфейсе админки. Проверьте консоль и настройки окружения.",
    unknownError: "Неизвестная ошибка",
    adminApiUnavailable: "Не удалось подключиться к админ API. Проверьте переменные окружения и логи билда.",
    selectOrder: "Выберите заказ, чтобы посмотреть детали.",
    selectBlock: "Выберите блок для редактирования.",
    useSidebar: "Используйте меню слева, чтобы управлять каталогом, заказами, медиа и страницами.",
    noCategory: "Без категории",
    imageUrlPrompt: "URL изображения",
    visible: "Показывать",
    noIngredients: "Ингредиенты ещё не заведены.",
  },
  confirm: {
    deleteCategory: "Удалить категорию?",
    deleteProduct: "Удалить товар?",
    deleteIngredient: "Удалить ингредиент?",
    deleteFile: "Удалить файл?",
    deleteBlock: "Удалить блок?",
    deletePage: "Удалить страницу?",
  },
  validation: {
    passwordMin: (min) => `Пароль минимум ${min} символов`,
    passwordRequired: "Пароль обязателен",
    invalidValue: "Некорректное значение",
  },
  orderStatus: {
    new: "Новый",
    preparing: "Готовится",
    delivering: "Доставка",
    done: "Выполнен",
  },
};

const BLOCK_TYPES = [
  { type: "hero", label: RU.blocks.hero, defaultProps: { title: "", subtitle: "", buttonLabel: "", buttonLink: "" } },
  { type: "banner", label: RU.blocks.banner, defaultProps: { text: "" } },
  { type: "text", label: RU.blocks.text, defaultProps: { text: "" } },
  { type: "gallery", label: RU.blocks.gallery, defaultProps: { title: "", images: [] } },
  { type: "products-grid", label: RU.blocks.productsGrid, defaultProps: { title: "", items: [] } },
];

const navItems = [
  { id: "dashboard", label: RU.nav.dashboard },
  { id: "products", label: RU.nav.products },
  { id: "categories", label: RU.nav.categories },
  { id: "ingredients", label: RU.nav.ingredients },
  { id: "inventory", label: RU.nav.inventory },
  { id: "orders", label: RU.nav.orders },
  { id: "media", label: RU.nav.media },
  { id: "pages", label: RU.nav.pages },
];

function Button({ children, variant = "primary", ...props }) {
  const base = "px-4 py-2 rounded-md text-sm font-medium transition";
  const styles = {
    primary: "bg-indigo-500 hover:bg-indigo-600 text-white",
    secondary: "bg-slate-700 hover:bg-slate-600 text-white",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-200",
    danger: "bg-rose-500 hover:bg-rose-600 text-white",
  };
  return (
    <button className={`${base} ${styles[variant]}`} {...props} />
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-200">
      <span className="text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      className="rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      {...props}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      className="rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      {...props}
    />
  );
}

function Select(props) {
  return (
    <select
      className="rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      {...props}
    />
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
          <div className="bg-slate-900 rounded-xl p-6 max-w-lg w-full space-y-3">
            <h2 className="text-lg font-semibold">{RU.messages.errorLoadingAdmin}</h2>
            <p className="text-sm text-slate-400">
              {RU.messages.errorLoadingUi}
            </p>
            <pre className="text-xs text-rose-300 whitespace-pre-wrap break-words">
              {this.state.error?.message || RU.messages.unknownError}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function LoadingScreen({ label = RU.messages.loading }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md text-center space-y-3">
        <div className="h-10 w-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function ErrorState({ title, message, details, onRetry }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="bg-slate-900 rounded-xl p-6 w-full max-w-lg space-y-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-slate-400">{message}</p>
        {details && (
          <pre className="text-xs text-rose-300 whitespace-pre-wrap break-words">
            {details}
          </pre>
        )}
        {onRetry && (
          <Button onClick={onRetry}>{RU.buttons.retry}</Button>
        )}
      </div>
    </div>
  );
}

function formatZodIssues(details) {
  if (!Array.isArray(details)) return null;
  const lines = details
    .map((issue) => {
      if (!issue || typeof issue !== "object") return null;
      const path = Array.isArray(issue.path) ? issue.path.join(".") : "";
      if (path === "password" && issue.code === "too_small" && typeof issue.minimum === "number") {
        return RU.validation.passwordMin(issue.minimum);
      }
      if (path === "password" && issue.code === "invalid_type") {
        return RU.validation.passwordRequired;
      }
      if (issue.message) return path ? `${path}: ${issue.message}` : issue.message;
      return path ? `${path}: ${RU.validation.invalidValue}` : RU.validation.invalidValue;
    })
    .filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

function Login({ onLogin, onNavigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState("loading");
  const [missingEnv, setMissingEnv] = useState([]);
  const [healthError, setHealthError] = useState("");

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    const loadHealth = async () => {
      try {
        const response = await fetch("/api/health", {
          signal: controller.signal,
          headers: { accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(RU.messages.healthCheckFailed(response.status));
        }
        const payload = await response.json();
        const missing = Array.isArray(payload?.missing)
          ? payload.missing.filter((item) => typeof item === "string")
          : [];
        if (isActive) {
          setMissingEnv(missing);
          setHealthStatus("ready");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (isActive) {
          setHealthError(err?.message || RU.messages.envCheckFailed);
          setHealthStatus("error");
        }
      }
    };

    loadHealth();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await onLogin({ email, password });
      if (onNavigate) {
        onNavigate("/admin");
      }
      return user;
    } catch (err) {
      const zodMessage = formatZodIssues(err?.details);
      const envMessage =
        err?.status === 500 && typeof err?.message === "string" && err.message.startsWith(RU.messages.envNotConfiguredPrefix);
      const fallbackMessage = err?.message || RU.messages.loginFailed;
      setError(envMessage ? err.message : zodMessage || fallbackMessage);
    } finally {
      setLoading(false);
    }
  };

  if (healthStatus === "loading") {
    return <LoadingScreen label={RU.messages.loadingAdminConfig} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
      <form onSubmit={handleSubmit} className="bg-slate-900 p-8 rounded-xl shadow-xl w-full max-w-md flex flex-col gap-4">
        <h1 className="text-xl font-semibold">{RU.headings.adminLogin}</h1>
        <p className="text-sm text-slate-400">{RU.messages.adminLoginHint}</p>
        <p className="text-xs text-slate-500">
          {RU.messages.adminPasswordInfoPrefix}{" "}
          <code className="text-slate-300">ADMIN_OWNER_EMAIL</code>,{" "}
          <code className="text-slate-300">ADMIN_OWNER_PASSWORD_HASH</code> или{" "}
          <code className="text-slate-300">ADMIN_OWNER_PASSWORD</code>{" "}
          {RU.messages.adminPasswordInfoSuffix}
        </p>
        {healthStatus === "error" && (
          <p className="text-amber-400 text-xs whitespace-pre-line">
            {RU.messages.envCheckFailed} {healthError}
          </p>
        )}
        {missingEnv.length > 0 && (
          <div className="rounded-md border border-amber-700 bg-amber-950/60 p-3 text-sm text-amber-200">
            <p className="font-medium">{RU.messages.missingEnv}</p>
            <ul className="list-disc list-inside text-xs text-amber-100 mt-2">
              {missingEnv.map((name) => (
                <li key={name}>
                  <code>{name}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Field label={RU.labels.email}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label={RU.labels.password}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <p className="text-rose-400 text-sm whitespace-pre-line">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? RU.buttons.signingIn : RU.buttons.signIn}
        </Button>
      </form>
    </div>
  );
}

function CategoriesView() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [sort, setSort] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const load = async () => {
    const data = await adminApi.listCategories();
    setItems(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    await adminApi.createCategory({ title, sort: Number(sort), isActive });
    setTitle("");
    setSort(0);
    setIsActive(true);
    await load();
  };

  const handleUpdate = async (item) => {
    await adminApi.updateCategory(item.id, {
      title: item.title,
      sort: Number(item.sort),
      isActive: item.is_active === 1,
    });
    await load();
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmPopup({ message: RU.confirm.deleteCategory });
    if (!confirmed) return;
    await adminApi.deleteCategory(id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">{RU.headings.newCategory}</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label={RU.labels.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={RU.labels.sort}>
            <Input type="number" value={sort} onChange={(e) => setSort(e.target.value)} />
          </Field>
          <Field label={RU.labels.active}>
            <Select value={isActive ? "yes" : "no"} onChange={(e) => setIsActive(e.target.value === "yes")}>
              <option value="yes">{RU.labels.statusActive}</option>
              <option value="no">{RU.labels.statusInactive}</option>
            </Select>
          </Field>
        </div>
        <Button onClick={handleCreate} disabled={!title.trim()}>{RU.buttons.create}</Button>
      </div>
      <div className="bg-slate-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">{RU.headings.categories}</h2>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="grid md:grid-cols-4 gap-3 items-center border border-slate-800 rounded-lg p-3">
              <Input
                value={item.title}
                onChange={(e) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, title: e.target.value } : row)))}
              />
              <Input
                type="number"
                value={item.sort}
                onChange={(e) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, sort: e.target.value } : row)))}
              />
              <Select
                value={item.is_active ? "yes" : "no"}
                onChange={(e) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, is_active: e.target.value === "yes" ? 1 : 0 } : row)))}
              >
                <option value="yes">{RU.labels.statusActive}</option>
                <option value="no">{RU.labels.statusInactive}</option>
              </Select>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => handleUpdate(item)}>{RU.buttons.save}</Button>
                <Button variant="danger" onClick={() => handleDelete(item.id)}>{RU.buttons.delete}</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IngredientsView() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [isActive, setIsActive] = useState(true);

  const load = async () => {
    const data = await adminApi.listIngredients();
    setItems(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    await adminApi.createIngredient({ title, unit: "g", isActive });
    setTitle("");
    setIsActive(true);
    await load();
  };

  const handleUpdate = async (item) => {
    await adminApi.updateIngredient(item.id, {
      title: item.title,
      unit: item.unit || "g",
      isActive: item.is_active === 1,
    });
    await load();
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmPopup({ message: RU.confirm.deleteIngredient });
    if (!confirmed) return;
    await adminApi.deleteIngredient(id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">{RU.headings.ingredients}</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label={RU.labels.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={RU.labels.active}>
            <Select value={isActive ? "yes" : "no"} onChange={(e) => setIsActive(e.target.value === "yes")}>
              <option value="yes">{RU.labels.statusActive}</option>
              <option value="no">{RU.labels.statusInactive}</option>
            </Select>
          </Field>
          <Field label={RU.labels.unit}>
            <Input value="g" disabled />
          </Field>
        </div>
        <Button onClick={handleCreate} disabled={!title.trim()}>{RU.buttons.create}</Button>
      </div>
      <div className="bg-slate-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">{RU.headings.ingredients}</h2>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="grid md:grid-cols-4 gap-3 items-center border border-slate-800 rounded-lg p-3">
              <Input
                value={item.title}
                onChange={(e) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, title: e.target.value } : row)))}
              />
              <Input value={item.unit || "g"} disabled />
              <Select
                value={item.is_active ? "yes" : "no"}
                onChange={(e) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, is_active: e.target.value === "yes" ? 1 : 0 } : row)))}
              >
                <option value="yes">{RU.labels.statusActive}</option>
                <option value="no">{RU.labels.statusInactive}</option>
              </Select>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => handleUpdate(item)}>{RU.buttons.save}</Button>
                <Button variant="danger" onClick={() => handleDelete(item.id)}>{RU.buttons.delete}</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InventoryView() {
  const [items, setItems] = useState([]);

  const load = async () => {
    const data = await adminApi.listInventory();
    setItems(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdate = async (item) => {
    await adminApi.updateInventory(item.id, { qtyAvailable: Number(item.qty_available || 0) });
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">{RU.headings.inventory}</h2>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="grid md:grid-cols-4 gap-3 items-center border border-slate-800 rounded-lg p-3">
              <div className="text-sm">{item.title}</div>
              <Input value={item.unit || "g"} disabled />
              <Input
                type="number"
                min="0"
                step="0.1"
                value={item.qty_available}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((row) =>
                      row.id === item.id ? { ...row, qty_available: e.target.value } : row
                    )
                  )
                }
              />
              <Button variant="secondary" onClick={() => handleUpdate(item)}>{RU.buttons.save}</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MediaLibrary({ onSelect, onClose }) {
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null);

  const load = async () => {
    const data = await adminApi.listMedia();
    setItems(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    await adminApi.uploadMedia(file);
    setFile(null);
    await load();
  };

  const handleDelete = async (key) => {
    const confirmed = await confirmPopup({ message: RU.confirm.deleteFile });
    if (!confirmed) return;
    await adminApi.deleteMedia(key);
    await load();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl p-6 w-full max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{RU.headings.mediaLibrary}</h3>
          <Button variant="ghost" onClick={onClose}>{RU.buttons.close}</Button>
        </div>
        <div className="flex gap-3 items-center">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Button onClick={handleUpload} disabled={!file}>{RU.buttons.upload}</Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[400px] overflow-auto">
          {items.map((item) => (
            <div key={item.key} className="border border-slate-800 rounded-lg p-2 space-y-2">
              <img
                src={resolveMediaUrl(item.url)}
                alt={item.meta?.name || item.key}
                className="w-full h-28 object-cover rounded-md"
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => onSelect(item.url)}>{RU.buttons.use}</Button>
                <Button variant="danger" onClick={() => handleDelete(item.key)}>{RU.buttons.delete}</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductsView() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [form, setForm] = useState({
    id: null,
    title: "",
    description: "",
    price: 0,
    categoryId: "",
    isActive: true,
    isFeatured: false,
    sort: 0,
    images: [],
    ingredients: [],
  });
  const [mediaOpen, setMediaOpen] = useState(false);

  const load = async () => {
    const [productsData, categoriesData, ingredientsData] = await Promise.all([
      adminApi.listProducts(),
      adminApi.listCategories(),
      adminApi.listIngredients(),
    ]);
    setProducts(productsData);
    setCategories(categoriesData);
    setIngredients(ingredientsData);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({
      id: null,
      title: "",
      description: "",
      price: 0,
      categoryId: "",
      isActive: true,
      isFeatured: false,
      sort: 0,
      images: [],
      ingredients: [],
    });
  };

  const handleSubmit = async () => {
    const payload = {
      title: form.title,
      description: form.description,
      price: Number(form.price),
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      sort: Number(form.sort),
      images: form.images.map((url, index) => ({ url, sort: index })),
      ingredients: form.ingredients
        .filter((item) => item.ingredientId && item.qtyGrams)
        .map((item) => ({
          ingredientId: Number(item.ingredientId),
          qtyGrams: Number(item.qtyGrams),
        })),
    };
    if (form.id) {
      await adminApi.updateProduct(form.id, payload);
    } else {
      await adminApi.createProduct(payload);
    }
    resetForm();
    await load();
  };

  const handleEdit = (product) => {
    setForm({
      id: product.id,
      title: product.title,
      description: product.description || "",
      price: product.price,
      categoryId: product.category_id || "",
      isActive: product.is_active === 1,
      isFeatured: product.is_featured === 1,
      sort: product.sort,
      images: product.images?.map((img) => img.url) || [],
      ingredients:
        product.ingredients?.map((item) => ({
          ingredientId: String(item.ingredient_id),
          qtyGrams: String(item.qty_grams),
        })) || [],
    });
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmPopup({ message: RU.confirm.deleteProduct });
    if (!confirmed) return;
    await adminApi.deleteProduct(id);
    await load();
  };

  const addImage = (url) => {
    if (!url) return;
    setForm((prev) => ({ ...prev, images: [...prev.images, url] }));
  };

  const removeImage = (index) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const addIngredient = () => {
    setForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { ingredientId: "", qtyGrams: "" }],
    }));
  };

  const updateIngredient = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeIngredient = (index) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">{RU.headings.productEditor}</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label={RU.labels.title}>
            <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
          </Field>
          <Field label={RU.labels.price}>
            <Input type="number" value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))} />
          </Field>
          <Field label={RU.labels.category}>
            <Select value={form.categoryId} onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}>
              <option value="">{RU.messages.noCategory}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.title}</option>
              ))}
            </Select>
          </Field>
          <Field label={RU.labels.sort}>
            <Input type="number" value={form.sort} onChange={(e) => setForm((prev) => ({ ...prev, sort: e.target.value }))} />
          </Field>
          <Field label={RU.labels.active}>
            <Select value={form.isActive ? "yes" : "no"} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === "yes" }))}>
              <option value="yes">{RU.labels.statusActive}</option>
              <option value="no">{RU.labels.statusInactive}</option>
            </Select>
          </Field>
          <Field label={RU.labels.featured}>
            <Select value={form.isFeatured ? "yes" : "no"} onChange={(e) => setForm((prev) => ({ ...prev, isFeatured: e.target.value === "yes" }))}>
              <option value="yes">{RU.labels.yes}</option>
              <option value="no">{RU.labels.no}</option>
            </Select>
          </Field>
        </div>
        <Field label={RU.labels.description}>
          <Textarea rows={4} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
        </Field>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">{RU.labels.ingredients}</span>
            <Button variant="secondary" onClick={addIngredient}>{RU.buttons.addIngredient}</Button>
          </div>
          {ingredients.length === 0 && (
            <p className="text-xs text-slate-500">{RU.messages.noIngredients}</p>
          )}
          <div className="space-y-2">
            {form.ingredients.map((item, index) => (
              <div key={`ingredient-${index}`} className="grid md:grid-cols-3 gap-3 items-center">
                <Select
                  value={item.ingredientId}
                  onChange={(e) => updateIngredient(index, "ingredientId", e.target.value)}
                >
                  <option value="">{RU.labels.ingredient}</option>
                  {ingredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>{ingredient.title}</option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={item.qtyGrams}
                  onChange={(e) => updateIngredient(index, "qtyGrams", e.target.value)}
                  placeholder={RU.labels.qtyGrams}
                />
                <Button variant="danger" onClick={() => removeIngredient(index)}>{RU.buttons.remove}</Button>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">{RU.labels.images}</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setMediaOpen(true)}>{RU.headings.mediaLibrary}</Button>
              <Button variant="secondary" onClick={() => addImage(window.prompt(RU.messages.imageUrlPrompt) || "")}>{RU.buttons.addUrl}</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {form.images.map((url, index) => (
              <div key={`${url}-${index}`} className="border border-slate-800 rounded-lg p-2 space-y-2">
            <img src={resolveMediaUrl(url)} alt="" className="w-full h-24 object-cover rounded-md" />
                <Button variant="danger" onClick={() => removeImage(index)}>{RU.buttons.remove}</Button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={!form.title.trim()}>{RU.buttons.save}</Button>
          <Button variant="ghost" onClick={resetForm}>{RU.buttons.reset}</Button>
        </div>
      </div>
      <div className="bg-slate-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">{RU.headings.products}</h2>
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="border border-slate-800 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="font-medium">{product.title}</div>
                <div className="text-sm text-slate-400">{product.price} ₽</div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => handleEdit(product)}>{RU.buttons.edit}</Button>
                <Button variant="danger" onClick={() => handleDelete(product.id)}>{RU.buttons.delete}</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {mediaOpen && (
        <MediaLibrary
          onSelect={(url) => {
            addImage(url);
            setMediaOpen(false);
          }}
          onClose={() => setMediaOpen(false)}
        />
      )}
    </div>
  );
}

function OrdersView() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const getStatusLabel = (status) => RU.orderStatus[status] || status;

  const load = async () => {
    const data = await adminApi.listOrders();
    setOrders(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSelect = async (order) => {
    const data = await adminApi.getOrder(order.id);
    setSelected(data);
  };

  const updateStatus = async (status) => {
    if (!selected) return;
    await adminApi.updateOrderStatus(selected.id, status);
    await load();
    const refreshed = await adminApi.getOrder(selected.id);
    setSelected(refreshed);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="bg-slate-900 rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">{RU.headings.orders}</h2>
        {orders.map((order) => (
          <button
            key={order.id}
            className={`w-full text-left border border-slate-800 rounded-lg p-3 ${selected?.id === order.id ? "bg-slate-800" : ""}`}
            onClick={() => handleSelect(order)}
          >
            <div className="font-medium">#{order.id} • {order.customer_name}</div>
            <div className="text-sm text-slate-400">{getStatusLabel(order.status)} • {order.total} ₽</div>
          </button>
        ))}
      </div>
      <div className="bg-slate-900 rounded-xl p-6 lg:col-span-2">
        {!selected ? (
          <p className="text-slate-400">{RU.messages.selectOrder}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{RU.headings.orderDetails} #{selected.id}</h3>
              <p className="text-sm text-slate-400">{selected.customer_name} • {selected.phone}</p>
              <p className="text-sm text-slate-400">{selected.address}</p>
            </div>
            <div className="space-y-2">
              {selected.items?.map((item, index) => (
                <div key={`${item.id}-${index}`} className="flex justify-between text-sm">
                  <span>{item.title} × {item.qty}</span>
                  <span>{item.price} ₽</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {["new", "preparing", "delivering", "done"].map((status) => (
                <Button key={status} variant={selected.status === status ? "secondary" : "ghost"} onClick={() => updateStatus(status)}>
                  {getStatusLabel(status)}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function ProductsGridEditor({ block, products, onChange }) {
  const items = Array.isArray(block.props.items)
    ? block.props.items
    : products.map((product) => ({ id: product.id, visible: true }));

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    onChange({ ...block.props, items: reordered });
  };

  const toggleVisibility = (id) => {
    const updated = items.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item));
    onChange({ ...block.props, items: updated });
  };

  const productMap = new Map(products.map((product) => [product.id, product]));

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => {
              const product = productMap.get(item.id);
              if (!product) return null;
              return (
                <SortableItem key={item.id} id={item.id}>
                  <div className="flex items-center justify-between border border-slate-800 rounded-lg p-2">
                    <span className="text-sm">{product.title}</span>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.visible !== false}
                        onChange={() => toggleVisibility(item.id)}
                      />
                      {RU.messages.visible}
                    </label>
                  </div>
                </SortableItem>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function PageBuilder({ page, onRefresh }) {
  const [blocks, setBlocks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [products, setProducts] = useState([]);
  const getBlockLabel = (type) => BLOCK_TYPES.find((item) => item.type === type)?.label || type;

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    adminApi.listPageBlocks(page.id).then((items) => {
      setBlocks(items);
      setSelected(items[0] || null);
    });
    adminApi.listProducts().then(setProducts);
  }, [page.id]);

  const handleAddBlock = async (blockType) => {
    const definition = BLOCK_TYPES.find((item) => item.type === blockType);
    const payload = {
      pageId: page.id,
      sort: blocks.length,
      type: definition.type,
      props: definition.defaultProps,
    };
    const result = await adminApi.createPageBlock(payload);
    const newBlock = { id: result.id, page_id: page.id, sort: payload.sort, type: payload.type, props: payload.props };
    const updated = [...blocks, newBlock];
    setBlocks(updated);
    setSelected(newBlock);
    await onRefresh();
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((item) => item.id === active.id);
    const newIndex = blocks.findIndex((item) => item.id === over.id);
    const reordered = arrayMove(blocks, oldIndex, newIndex).map((item, index) => ({ ...item, sort: index }));
    setBlocks(reordered);
    await adminApi.reorderPageBlocks(page.id, reordered.map((item) => item.id));
  };

  const updateSelectedProps = (props) => {
    setSelected((prev) => (prev ? { ...prev, props } : prev));
    setBlocks((prev) => prev.map((item) => (item.id === selected.id ? { ...item, props } : item)));
  };

  const saveSelected = async () => {
    if (!selected) return;
    await adminApi.updatePageBlock(selected.id, {
      sort: selected.sort,
      type: selected.type,
      props: selected.props || {},
    });
    await onRefresh();
  };

  const deleteSelected = async () => {
    if (!selected) return;
    const confirmed = await confirmPopup({ message: RU.confirm.deleteBlock });
    if (!confirmed) return;
    await adminApi.deletePageBlock(selected.id);
    const updated = blocks.filter((block) => block.id !== selected.id);
    setBlocks(updated);
    setSelected(updated[0] || null);
    await onRefresh();
  };

  return (
    <div className="grid lg:grid-cols-[240px_1fr_320px] gap-6">
      <div className="bg-slate-900 rounded-xl p-4 space-y-3">
        <h3 className="text-sm text-slate-400">{RU.headings.blocks}</h3>
        {BLOCK_TYPES.map((block) => (
          <Button key={block.type} variant="secondary" onClick={() => handleAddBlock(block.type)}>
            + {block.label}
          </Button>
        ))}
      </div>
      <div className="bg-slate-900 rounded-xl p-4">
        <h3 className="text-sm text-slate-400 mb-3">{RU.headings.canvas}</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {blocks.map((block) => (
                <SortableItem key={block.id} id={block.id}>
                  <button
                    className={`w-full text-left border border-slate-800 rounded-lg p-3 ${selected?.id === block.id ? "bg-slate-800" : ""}`}
                    onClick={() => setSelected(block)}
                  >
                    <div className="text-sm font-medium">{getBlockLabel(block.type)}</div>
                    <div className="text-xs text-slate-400">{RU.labels.sort}: {block.sort}</div>
                  </button>
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      <div className="bg-slate-900 rounded-xl p-4 space-y-4">
        <h3 className="text-sm text-slate-400">{RU.headings.properties}</h3>
        {!selected ? (
          <p className="text-slate-500 text-sm">{RU.messages.selectBlock}</p>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-medium">{getBlockLabel(selected.type)}</div>
            {selected.type === "hero" && (
              <>
                <Field label={RU.labels.title}>
                  <Input value={selected.props.title || ""} onChange={(e) => updateSelectedProps({ ...selected.props, title: e.target.value })} />
                </Field>
                <Field label={RU.labels.subtitle}>
                  <Textarea value={selected.props.subtitle || ""} onChange={(e) => updateSelectedProps({ ...selected.props, subtitle: e.target.value })} />
                </Field>
                <Field label={RU.labels.buttonLabel}>
                  <Input value={selected.props.buttonLabel || ""} onChange={(e) => updateSelectedProps({ ...selected.props, buttonLabel: e.target.value })} />
                </Field>
                <Field label={RU.labels.buttonLink}>
                  <Input value={selected.props.buttonLink || ""} onChange={(e) => updateSelectedProps({ ...selected.props, buttonLink: e.target.value })} />
                </Field>
              </>
            )}
            {selected.type === "banner" && (
              <Field label={RU.labels.text}>
                <Textarea value={selected.props.text || ""} onChange={(e) => updateSelectedProps({ ...selected.props, text: e.target.value })} />
              </Field>
            )}
            {selected.type === "text" && (
              <Field label={RU.labels.content}>
                <Textarea value={selected.props.text || ""} onChange={(e) => updateSelectedProps({ ...selected.props, text: e.target.value })} />
              </Field>
            )}
            {selected.type === "gallery" && (
              <>
                <Field label={RU.labels.title}>
                  <Input value={selected.props.title || ""} onChange={(e) => updateSelectedProps({ ...selected.props, title: e.target.value })} />
                </Field>
                <Field label={RU.labels.imagesComma}>
                  <Textarea
                    value={(selected.props.images || []).join(", ")}
                    onChange={(e) => updateSelectedProps({ ...selected.props, images: e.target.value.split(",").map((url) => url.trim()).filter(Boolean) })}
                  />
                </Field>
              </>
            )}
            {selected.type === "products-grid" && (
              <>
                <Field label={RU.labels.title}>
                  <Input value={selected.props.title || ""} onChange={(e) => updateSelectedProps({ ...selected.props, title: e.target.value })} />
                </Field>
                <ProductsGridEditor
                  block={selected}
                  products={products}
                  onChange={(props) => updateSelectedProps(props)}
                />
              </>
            )}
            <div className="flex gap-2">
              <Button onClick={saveSelected}>{RU.buttons.save}</Button>
              <Button variant="danger" onClick={deleteSelected}>{RU.buttons.delete}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PagesView() {
  const [pages, setPages] = useState([]);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [selectedPage, setSelectedPage] = useState(null);

  const load = async () => {
    const data = await adminApi.listPages();
    setPages(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    await adminApi.createPage({ slug, title });
    setSlug("");
    setTitle("");
    await load();
  };

  const handleSelect = (page) => {
    setSelectedPage(page);
  };

  const handleDelete = async (page) => {
    const confirmed = await confirmPopup({ message: RU.confirm.deletePage });
    if (!confirmed) return;
    await adminApi.deletePage(page.id);
    setSelectedPage(null);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">{RU.headings.newPage}</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label={RU.labels.slug}>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </Field>
          <Field label={RU.labels.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        </div>
        <Button onClick={handleCreate} disabled={!slug || !title}>{RU.buttons.create}</Button>
      </div>
      <div className="bg-slate-900 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">{RU.headings.pages}</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {pages.map((page) => (
            <div key={page.id} className={`border border-slate-800 rounded-lg p-3 space-y-2 ${selectedPage?.id === page.id ? "bg-slate-800" : ""}`}>
              <div className="font-medium">{page.title}</div>
              <div className="text-xs text-slate-400">/{page.slug}</div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => handleSelect(page)}>{RU.buttons.edit}</Button>
                <Button variant="danger" onClick={() => handleDelete(page)}>{RU.buttons.delete}</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {selectedPage && (
        <div className="bg-slate-900 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{RU.headings.pageBuilder}</h3>
              <p className="text-sm text-slate-400">/{selectedPage.slug}</p>
            </div>
            <a
              href={`/page/${selectedPage.slug}`}
              className="text-sm text-indigo-300 underline"
              target="_blank"
              rel="noreferrer"
            >
              {RU.buttons.viewPublicPage}
            </a>
          </div>
          <PageBuilder page={selectedPage} onRefresh={load} />
        </div>
      )}
    </div>
  );
}

function MediaView() {
  const [items, setItems] = useState([]);

  const load = async () => {
    const data = await adminApi.listMedia();
    setItems(data);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="bg-slate-900 rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold">{RU.headings.mediaLibrary}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.key} className="border border-slate-800 rounded-lg p-2">
            <img
              src={resolveMediaUrl(item.url)}
              alt={item.meta?.name || item.key}
              className="w-full h-24 object-cover rounded-md"
            />
            <p className="text-xs text-slate-400 mt-2 truncate">{item.meta?.name || item.key}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="bg-slate-900 rounded-xl p-6">
      <h2 className="text-lg font-semibold">{RU.headings.dashboard}</h2>
      <p className="text-slate-400">{RU.messages.useSidebar}</p>
    </div>
  );
}

function AdminLayout({ user, onLogout }) {
  const [view, setView] = useState("dashboard");

  const content = useMemo(() => {
    switch (view) {
      case "products":
        return <ProductsView />;
      case "categories":
        return <CategoriesView />;
      case "ingredients":
        return <IngredientsView />;
      case "inventory":
        return <InventoryView />;
      case "orders":
        return <OrdersView />;
      case "media":
        return <MediaView />;
      case "pages":
        return <PagesView />;
      default:
        return <Dashboard />;
    }
  }, [view]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-64 bg-slate-900 p-6 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">{RU.headings.adminPanel}</h1>
          <p className="text-xs text-slate-400">{user.email}</p>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`w-full text-left px-3 py-2 rounded-lg ${view === item.id ? "bg-indigo-500" : "hover:bg-slate-800"}`}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <Button variant="ghost" onClick={onLogout}>{RU.buttons.logout}</Button>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        {content}
      </main>
    </div>
  );
}

function AdminApp({ navigate, initialPath }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const goTo = (path) => {
    if (navigate) {
      navigate(path);
    } else {
      window.history.pushState({}, "", path);
    }
  };

  const fetchSession = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const data = await adminApi.me();
      if (data) {
        setUser(data);
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("unauthenticated");
      }
    } catch (err) {
      setUser(null);
      if (err.status === 401 || err.status === 403) {
        setStatus("unauthenticated");
      } else {
        setStatus("error");
        setError(err);
      }
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleLogin = async ({ email, password }) => {
    const data = await adminApi.login(email, password);
    if (!data) {
      const error = new Error(RU.messages.loginErrorFallback);
      error.status = 401;
      throw error;
    }
    setUser(data);
    setStatus("authenticated");
    setError(null);
    return data;
  };

  const handleLogout = async () => {
    await adminApi.logout();
    setUser(null);
    setStatus("unauthenticated");
    goTo("/admin/login");
  };

  const isLoginRoute = (initialPath || window.location.pathname).startsWith("/admin/login");

  if (status === "loading") {
    return <LoadingScreen label={RU.messages.loadingAdminAccess} />;
  }

  if (status === "error") {
    const errorMessage =
      error?.message || RU.messages.adminApiUnavailable;
    return (
      <ErrorState
        title={RU.messages.errorLoadingAdmin}
        message={errorMessage}
        details={error?.details ? JSON.stringify(error.details, null, 2) : error?.message}
        onRetry={fetchSession}
      />
    );
  }

  if (status === "unauthenticated" || !user) {
    if (!isLoginRoute) {
      goTo("/admin/login");
    }
    return <Login onLogin={handleLogin} onNavigate={isLoginRoute ? goTo : null} />;
  }

  if (isLoginRoute) {
    goTo("/admin");
  }

  return <AdminLayout user={user} onLogout={handleLogout} />;
}

export function mountAdminApp(container, options = {}) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <AdminApp navigate={options.navigate} initialPath={options.initialPath} />
    </ErrorBoundary>
  );
  return () => root.unmount();
}
