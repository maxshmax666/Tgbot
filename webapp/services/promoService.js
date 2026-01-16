export async function fetchPromos() {
  const response = await fetch("/data/promos.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (text.trim().startsWith("<")) {
    throw new Error("promos.json returned HTML (wrong path)");
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error("promos.json is not valid JSON");
  }
  if (!Array.isArray(payload)) {
    throw new Error("promos.json has unexpected shape");
  }
  return payload.map((promo) => ({
    id: String(promo?.id ?? promo?.code ?? ""),
    title: String(promo?.title ?? ""),
    description: String(promo?.description ?? ""),
    type: String(promo?.type ?? "fixed"),
    value: Number(promo?.value ?? 0),
    code: promo?.code ? String(promo.code) : "",
    expiresAt: promo?.expiresAt ? String(promo.expiresAt) : "",
    active: promo?.active !== false,
  }));
}
