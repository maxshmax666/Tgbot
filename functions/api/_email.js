import { RequestError, requireEnv } from "./_utils.js";

export async function sendEmail(env, { to, subject, html, text }) {
  const apiKey = requireEnv(env.RESEND_API_KEY, "RESEND_API_KEY");
  const from = requireEnv(env.EMAIL_FROM, "EMAIL_FROM");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new RequestError(502, "Email provider error", details);
  }
}
