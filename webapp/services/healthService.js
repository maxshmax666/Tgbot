export async function checkHealth({ timeoutMs = 2500 } = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const result = {
    ok: false,
    status: null,
    error: null,
    timedOut: false,
  };
  try {
    const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
    result.status = response.status;
    result.ok = response.ok;
    if (!response.ok) {
      result.error = new Error(`Health check status ${response.status}`);
    }
  } catch (error) {
    result.error = error;
    result.timedOut = error?.name === "AbortError";
  } finally {
    window.clearTimeout(timeoutId);
  }
  return result;
}
