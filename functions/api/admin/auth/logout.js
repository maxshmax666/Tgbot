import { clearSessionCookie, json } from "../../_utils.js";

export async function onRequestPost({ request }) {
  const sessionCookie = clearSessionCookie(request);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie });
}
