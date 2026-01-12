import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  json,
  handleError,
  parseJsonBody,
  createToken,
  RequestError,
  createSessionCookie,
  requireEnv,
} from "../../_utils.js";

const loginSchema = z.object({
  password: z.string().min(6),
});

export async function onRequestPost({ env, request }) {
  try {
    const body = await parseJsonBody(request, loginSchema);
    const passwordHash = requireEnv(env.ADMIN_PASSWORD_HASH, "ADMIN_PASSWORD_HASH");
    const ok = await bcrypt.compare(body.password, passwordHash);
    if (!ok) throw new RequestError(401, "Invalid credentials");

    const token = await createToken({ sub: "admin", role: "owner", email: "admin" }, env);
    const sessionCookie = createSessionCookie(token, request);
    return json(
      { user: { id: "admin", email: "admin", role: "owner" } },
      200,
      { "set-cookie": sessionCookie }
    );
  } catch (err) {
    return handleError(err);
  }
}
