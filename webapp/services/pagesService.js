export async function fetchPageBySlug(slug) {
  const response = await fetch(`/api/public/pages/${slug}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
