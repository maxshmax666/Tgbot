import { json } from "./_utils.js";

export async function onRequestGet() {
  return json({ ok: true });
}
