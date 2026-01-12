import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

const textEncoder = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  const responseHeaders = new Headers({
    "content-type": "application/json; charset=utf-8",
  });
  Object.entries(headers).forEach(([key, value]) => {
    responseHeaders.set(key, value);
  });
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
}

export function error(status, message, details) {
  return json({ error: { message, details } }, status);
}

export function parseJsonBody(request, schema) {
  return request
    .json()
    .then((body) => schema.parse(body))
    .catch((err) => {
      if (err instanceof SyntaxError) {
        throw new RequestError(400, "Invalid JSON payload");
      }
      if (err?.issues) {
        throw new RequestError(400, "Validation failed", err.issues);
      }
      throw err;
    });
}

export class RequestError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function requireEnv(value, name) {
  if (!value) throw new RequestError(500, `${name} is not configured`);
  return value;
}

export function requireDb(env) {
  if (!env.DB) throw new RequestError(500, "DB binding is missing");
  return env.DB;
}

export async function ensureOwner(request, env, payload) {
  requireDb(env);
  const authPayload = payload ?? (request ? await requireAuth(request, env) : null);
  if (!authPayload) throw new RequestError(401, "Unauthorized");
  if (authPayload.role !== "owner") {
    throw new RequestError(403, "Forbidden");
  }
  return authPayload;
}

export async function createToken(payload, env) {
  const secret = requireEnv(env.JWT_SECRET, "JWT_SECRET");
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(textEncoder.encode(secret));
  return token;
}

export async function verifyToken(token, env) {
  const secret = requireEnv(env.JWT_SECRET, "JWT_SECRET");
  const { payload } = await jwtVerify(token, textEncoder.encode(secret));
  return payload;
}

export function getSessionToken(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((item) => item.trim());
  const tokenCookie = cookies.find((item) => item.startsWith("admin_session="));
  if (!tokenCookie) return null;
  const [, value] = tokenCookie.split("=");
  return value || null;
}

export function createSessionCookie(token, request) {
  const secure = new URL(request.url).protocol === "https:";
  const parts = [
    `admin_session=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=604800",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === "https:";
  const parts = ["admin_session=", "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function requireAuth(request, env) {
  const header = request.headers.get("authorization") || "";
  const [, bearerToken] = header.split(" ");
  const token = getSessionToken(request) || bearerToken;
  if (!token) throw new RequestError(401, "Unauthorized");
  try {
    const payload = await verifyToken(token, env);
    return payload;
  } catch (err) {
    throw new RequestError(401, "Invalid token");
  }
}

export function handleError(err) {
  if (err instanceof RequestError) {
    return error(err.status, err.message, err.details);
  }
  console.error(err);
  return error(500, "Internal server error");
}

export const idSchema = z.coerce.number().int().positive();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
