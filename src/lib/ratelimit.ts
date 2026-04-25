import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "./redis";

// Named rate limiters, all backed by the shared Upstash instance.
// Prefixes namespace alongside the existing consumers:
//   `bauth:*`         — Better Auth secondary storage (src/auth/secondary-storage.ts)
//   `reminders:*`     — upload-request reminder dedup (src/jobs/upload-request-reminder.ts)
//   `bauth-rl:*`      — rate limiter keys (this file)
//
// See docs/specs/security_posture.md §5 for the threat rationale.
//
// Caveat on IP derivation: `identifierFromRequest` uses `x-forwarded-for`
// when present and falls back to `x-real-ip` or the literal string
// "unknown". In local dev (`npm run dev`) neither header is set, so all
// requests share the "unknown" bucket — acceptable for smoke tests,
// expected in prod behind Render/Cloudflare/Vercel proxies where the
// header is populated.

export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "bauth-rl:auth",
  analytics: false,
});

export const inviteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "bauth-rl:invite",
  analytics: false,
});

// Reserved for future per-endpoint tightening of password-reset flow
// once we break it out from the generic auth bucket. Not currently
// wired — `authLimiter` covers /api/auth/* today.
export const passwordResetLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "bauth-rl:passreset",
  analytics: false,
});

// Per-IP cap on /api/org/tax-id/reveal. Each reveal writes an audit
// event, so the audit trail also catches enumeration — this limiter
// is the script-driven-burst defense. 5/min is comfortable for a
// human admin clicking through orgs; high-velocity programmatic
// access trips it. See docs/specs/tax_id_encryption_plan.md §7.
export const taxIdRevealLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "bauth-rl:taxid-reveal",
  analytics: false,
});

export function identifierFromRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export type LimitResult =
  | { ok: true }
  | { ok: false; reset: number; limit: number; remaining: number };

export async function enforceLimit(
  limiter: Ratelimit,
  req: Request,
): Promise<LimitResult> {
  const id = identifierFromRequest(req);
  const res = await limiter.limit(id);
  return res.success
    ? { ok: true }
    : {
        ok: false,
        reset: res.reset,
        limit: res.limit,
        remaining: res.remaining,
      };
}
