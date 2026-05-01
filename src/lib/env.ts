import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
  // Optional — present in split-role environments (runtime = DML-only
  // builtcrm_app, admin = DDL). Falls back to DATABASE_URL when absent.
  DATABASE_ADMIN_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  // Trigger.dev v3 SDK reads this var directly. Renamed from
  // TRIGGER_DEV_API_KEY to match the SDK's canonical name; the old name
  // was only ever validated, never consumed.
  TRIGGER_SECRET_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  // Public app base URL — used for Stripe Checkout redirects, SAML SP
  // metadata, and email/invite link construction. Without it,
  // invite-token routes silently fall back to http://localhost:3000.
  NEXT_PUBLIC_APP_URL: z.string().url(),
  // 32 bytes base64-encoded; protects organizations.tax_id at rest.
  // See docs/specs/security_posture.md §3 and
  // docs/specs/tax_id_encryption_plan.md. Generate with
  // `openssl rand -base64 32`.
  TAX_ID_ENCRYPTION_KEY: z.string().min(1),
  // Sentry (optional). When unset, Sentry no-ops cleanly and the app
  // runs without error monitoring.
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  // Meeting Minutes AI (Step 56). Both required when the feature is
  // wired up; transcribeAndExtract throws at the call site if either is
  // missing rather than blocking app boot, so dev environments without
  // AI keys still run.
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // API key hashing (Step 58). Server-side pepper for HMAC-SHA256(key)
  // → key_hash storage. Required: losing the pepper invalidates every
  // issued API key. Generate once with `openssl rand -base64 48` and
  // treat as a long-lived secret on the same blast-radius tier as
  // BETTER_AUTH_SECRET. The hash helper throws if this is missing.
  API_KEY_PEPPER: z.string().min(32).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `\n\u274c Invalid or missing environment variables:\n${issues}\n\nCheck your .env.local file.\n`
  );
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
