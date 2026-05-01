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

// ─── Step 59 — Per-API-key rate limits ───────────────────────────────
//
// API keys carry per-key configurable caps (api_keys.rate_limit_per_*)
// with platform defaults when null. Sliding-window limiters from
// `@upstash/ratelimit` bake the (limit, window) tuple into the
// instance, so per-key custom caps don't fit a single global limiter.
// Solution: cache one `Ratelimit` instance per (limit, window) tuple
// in a Map. Most orgs use the defaults, so the cache stays small —
// typically two entries (default minute, default hour). Custom-limit
// keys add an entry per unique tuple.
//
// Bucket key shape: `bauth-rl:apikey-{window}:{keyId}` — namespaced
// alongside the existing limiters so a future Redis cleanup can scan
// `bauth-rl:apikey-*` to nuke just this surface.

export const DEFAULT_API_KEY_RATE_LIMITS = {
  perMinute: 60,
  perHour: 1000,
} as const;

type Window = "1 m" | "1 h";

const apiKeyLimiterCache = new Map<string, Ratelimit>();

function getOrCreateLimiter(limit: number, window: Window): Ratelimit {
  const cacheKey = `${limit}:${window}`;
  const cached = apiKeyLimiterCache.get(cacheKey);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `bauth-rl:apikey-${window === "1 m" ? "min" : "hr"}`,
    analytics: false,
  });
  apiKeyLimiterCache.set(cacheKey, limiter);
  return limiter;
}

export type ApiKeyRateLimitInfo = {
  /** Effective per-minute cap for this key (override or default). */
  limit: number;
  /** Calls remaining in the current minute window after this request. */
  remaining: number;
  /** Unix-ms timestamp when the current minute window resets. */
  resetMs: number;
};

export type ApiKeyRateLimitResult =
  | { ok: true; minute: ApiKeyRateLimitInfo; hour: ApiKeyRateLimitInfo }
  | {
      ok: false;
      /** Which window blocked the request — useful for the 429 message. */
      blockedBy: "minute" | "hour";
      retryAfterSec: number;
      minute: ApiKeyRateLimitInfo;
      hour: ApiKeyRateLimitInfo;
    };

/**
 * Enforce both per-minute and per-hour caps for an API key in one
 * call. Both windows are checked even when the first one fails so
 * the headers we surface back to the client always reflect the full
 * rate-limit state — a client that sees "minute=0, hour=43" knows
 * to wait a few seconds vs "minute=0, hour=0" which means stop
 * for an hour.
 *
 * The hour window's reset timestamp is the authoritative `Retry-After`
 * source when the hour cap blocks; otherwise the minute window
 * dictates.
 */
export async function enforceApiKeyRateLimit(params: {
  keyId: string;
  perMinute: number | null;
  perHour: number | null;
}): Promise<ApiKeyRateLimitResult> {
  const minuteCap = params.perMinute ?? DEFAULT_API_KEY_RATE_LIMITS.perMinute;
  const hourCap = params.perHour ?? DEFAULT_API_KEY_RATE_LIMITS.perHour;

  const minuteLimiter = getOrCreateLimiter(minuteCap, "1 m");
  const hourLimiter = getOrCreateLimiter(hourCap, "1 h");

  // Run in parallel — independent counters; saves a Redis round-trip.
  const [minuteRes, hourRes] = await Promise.all([
    minuteLimiter.limit(params.keyId),
    hourLimiter.limit(params.keyId),
  ]);

  const minute: ApiKeyRateLimitInfo = {
    limit: minuteRes.limit,
    remaining: Math.max(0, minuteRes.remaining),
    resetMs: minuteRes.reset,
  };
  const hour: ApiKeyRateLimitInfo = {
    limit: hourRes.limit,
    remaining: Math.max(0, hourRes.remaining),
    resetMs: hourRes.reset,
  };

  if (!minuteRes.success || !hourRes.success) {
    // Hour-window blocks take precedence on Retry-After since waiting
    // out the minute window won't help.
    const blockedBy: "minute" | "hour" = !hourRes.success ? "hour" : "minute";
    const resetMs = blockedBy === "hour" ? hour.resetMs : minute.resetMs;
    const retryAfterSec = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
    return { ok: false, blockedBy, retryAfterSec, minute, hour };
  }
  return { ok: true, minute, hour };
}

/**
 * Materialize standard `X-RateLimit-*` headers from an enforce result.
 * Headers reflect the minute window (the more aggressive cap of the
 * two) so clients see the most useful next-action signal. Caller
 * routes spread this onto their response headers.
 */
export function rateLimitHeadersFor(result: ApiKeyRateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.minute.limit),
    "X-RateLimit-Remaining": String(result.minute.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.minute.resetMs / 1000)),
    "X-RateLimit-Limit-Hour": String(result.hour.limit),
    "X-RateLimit-Remaining-Hour": String(result.hour.remaining),
  };
  if (!result.ok) {
    headers["Retry-After"] = String(result.retryAfterSec);
  }
  return headers;
}
