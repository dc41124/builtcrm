// Step 65 Session B — Cloudflare Turnstile server-side verification.
//
// Free tier; no per-request cost. Set the secret via TURNSTILE_SECRET_KEY
// and the public site key via NEXT_PUBLIC_TURNSTILE_SITE_KEY. When both
// are unset (dev mode), verification is bypassed — handlers should still
// rate-limit on requester_email regardless. We log the bypass so it's
// obvious in dev logs.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Dev mode — fail open. The intake form still requires the user to
    // tick a checkbox; in production the secret is set and real verification
    // runs. We log so this isn't silently relied on.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[turnstile] TURNSTILE_SECRET_KEY not set — skipping verification (dev mode).",
      );
      return { ok: true };
    }
    return { ok: false, reason: "missing_secret" };
  }

  if (!token) return { ok: false, reason: "missing_token" };

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  let res: Response;
  try {
    res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (err) {
    return {
      ok: false,
      reason: `network_error: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }

  if (!res.ok) {
    return { ok: false, reason: `siteverify_http_${res.status}` };
  }

  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; "error-codes"?: string[] }
    | null;

  if (!json?.success) {
    const codes = (json?.["error-codes"] ?? []).join(",") || "unknown";
    return { ok: false, reason: `siteverify_failed:${codes}` };
  }

  return { ok: true };
}
