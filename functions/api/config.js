import { json } from "./_utils.js";

const EMPTY_STRING = "";

export async function onRequestGet({ env }) {
  const settings = {
    supportPhone: env?.SUPPORT_PHONE ?? EMPTY_STRING,
    supportChat: env?.SUPPORT_CHAT ?? EMPTY_STRING,
    publicMediaBaseUrl: env?.PUBLIC_MEDIA_BASE_URL ?? EMPTY_STRING,
  };

  return json({ ok: true, settings });
}
