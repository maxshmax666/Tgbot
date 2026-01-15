import { z } from "zod";
import { getRequestId, handleError, json, requireEnv, RequestError, createToken } from "../../_utils.js";

const authSchema = z.object({
  id: z.coerce.number().int().positive(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.coerce.number().int().positive(),
  hash: z.string().min(1),
});

const textEncoder = new TextEncoder();
const MAX_AUTH_AGE_SEC = 24 * 60 * 60;

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");

const buildCheckString = (data) => {
  const entries = Object.entries(data)
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`)
    .sort((a, b) => a.localeCompare(b));
  return entries.join("\n");
};

const computeHash = async (checkString, botToken) => {
  const secret = await crypto.subtle.digest("SHA-256", textEncoder.encode(botToken));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(checkString));
  return toHex(signature);
};

export async function onRequestPost({ env, request }) {
  const requestId = getRequestId(request);
  try {
    const botToken = requireEnv(env.BOT_TOKEN, "BOT_TOKEN");
    const payload = await request.json();
    const authData = authSchema.parse(payload);
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - authData.auth_date) > MAX_AUTH_AGE_SEC) {
      throw new RequestError(401, "Telegram auth expired");
    }

    const checkString = buildCheckString(authData);
    const expectedHash = await computeHash(checkString, botToken);
    if (expectedHash !== authData.hash) {
      throw new RequestError(401, "Invalid Telegram auth hash");
    }

    const user = {
      id: authData.id,
      first_name: authData.first_name,
      last_name: authData.last_name,
      username: authData.username,
      photo_url: authData.photo_url,
    };
    const token = await createToken(
      {
        sub: `tg:${authData.id}`,
        provider: "telegram",
        role: "user",
        username: authData.username,
        name: `${authData.first_name}${authData.last_name ? ` ${authData.last_name}` : ""}`.trim(),
      },
      env
    );
    return json({ user, token }, 200, requestId ? { "x-request-id": requestId } : {});
  } catch (err) {
    return handleError(err, requestId);
  }
}
