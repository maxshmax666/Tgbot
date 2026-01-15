import { z } from "zod";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getRequestId, handleError, json, requireEnv, RequestError, createToken } from "../../_utils.js";

const googleSchema = z.object({
  credential: z.string().min(1),
});

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function onRequestPost({ env, request }) {
  const requestId = getRequestId(request);
  try {
    const clientId = requireEnv(env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
    const body = await request.json();
    const { credential } = googleSchema.parse(body);

    const { payload } = await jwtVerify(credential, googleJwks, {
      audience: clientId,
    });
    if (!payload.iss || !GOOGLE_ISSUERS.has(String(payload.iss))) {
      throw new RequestError(401, "Invalid Google issuer");
    }
    if (!payload.email || payload.email_verified !== true) {
      throw new RequestError(401, "Google email not verified");
    }

    const user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
    const token = await createToken(
      {
        sub: `google:${payload.sub}`,
        provider: "google",
        role: "user",
        email: payload.email,
        name: payload.name,
      },
      env
    );
    return json({ user, token }, 200, requestId ? { "x-request-id": requestId } : {});
  } catch (err) {
    return handleError(err, requestId);
  }
}
