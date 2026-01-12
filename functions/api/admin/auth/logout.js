import { json } from "../../_utils.js";

export async function onRequestPost() {
  return json({ ok: true });
}
