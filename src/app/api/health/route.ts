import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { redis } from "@/lib/redis";

// Render's health probe pings this on every deploy. Returns 200 only
// when both Postgres + Upstash are reachable. No auth — Render must hit
// it anonymously. Don't ping Stripe / Resend / R2 here; their failures
// shouldn't take the app's deploy down. SELECT 1 doesn't touch any
// RLS-enabled table, so bare `db` is fine.
export async function GET() {
  const checks: Record<string, "ok" | "fail"> = { db: "fail", redis: "fail" };

  try {
    await db.execute(sql`select 1`);
    checks.db = "ok";
  } catch {
    // Swallow — checks.db stays "fail" and the response is 503.
  }

  try {
    await redis.ping();
    checks.redis = "ok";
  } catch {
    // Same.
  }

  const ok = checks.db === "ok" && checks.redis === "ok";
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", checks },
    { status: ok ? 200 : 503 },
  );
}
