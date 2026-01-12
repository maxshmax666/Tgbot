import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { z } from "zod";

const textEncoder = new TextEncoder();

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
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

export async function ensureOwner(env) {
  const db = env.DB;
  if (!db) throw new RequestError(500, "DB binding is missing");
  const existing = await db.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").first();
  if (existing) return;

  const email = env.ADMIN_EMAIL;
  const password = env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new RequestError(500, "ADMIN_EMAIL/ADMIN_PASSWORD are required for bootstrap");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await db
    .prepare(
      "INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'owner', datetime('now'))"
    )
    .bind(email.toLowerCase(), passwordHash)
    .run();
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

export async function requireAuth(request, env) {
  const header = request.headers.get("authorization") || "";
  const [, token] = header.split(" ");
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
