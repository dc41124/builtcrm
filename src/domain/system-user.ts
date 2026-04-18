import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";

// Deterministic UUID for the synthetic "system" actor used by
// non-interactive audit events (Stripe webhooks, Trigger.dev jobs, etc.).
// audit_events.actor_user_id is NOT NULL, so we need a real users row —
// this is that row. Seeded lazily via ensureSystemUser().
export const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

let ensured = false;

// Idempotent — inserts the system user row if it isn't there yet. Safe to
// call from any handler; first-call cost is a single INSERT with ON CONFLICT
// then later calls short-circuit via the in-memory flag.
export async function ensureSystemUser(): Promise<void> {
  if (ensured) return;
  await db
    .insert(users)
    .values({
      id: SYSTEM_USER_ID,
      email: "system@builtcrm.internal",
      displayName: "BuiltCRM System",
      isActive: false,
    })
    .onConflictDoNothing({ target: users.id });
  ensured = true;
}

// Convenience: some callers want both the ID and the guarantee that the row
// exists. This is the typical use site from a webhook handler.
export async function getSystemUserId(): Promise<string> {
  await ensureSystemUser();
  return SYSTEM_USER_ID;
}

// Assert: some tests / bootstrap code may want to confirm the row exists.
export async function systemUserExists(): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, SYSTEM_USER_ID))
    .limit(1);
  return !!row;
}
