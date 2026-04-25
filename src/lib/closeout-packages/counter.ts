import { and, eq, sql } from "drizzle-orm";

import { type DB } from "@/db/client";
import { closeoutCounters } from "@/db/schema";

type DbOrTx = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

// Atomic allocation of the next (orgId, year) sequence number. Runs as
// UPDATE ... RETURNING inside the caller's transaction; if no row
// exists yet, inserts one with last_seq = 1 and returns 1.
//
// SELECT MAX+1 loses under concurrent create-package requests — two
// parallel txns would read the same max, both insert with seq N+1, and
// the unique index fires on one. Using an UPDATE with row-lock ensures
// serializable allocation.
export async function allocateCloseoutSequence(
  dbc: DbOrTx,
  input: { organizationId: string; year: number },
): Promise<number> {
  // Try to bump an existing row first.
  const bumped = await dbc
    .update(closeoutCounters)
    .set({ lastSeq: sql`${closeoutCounters.lastSeq} + 1` })
    .where(
      and(
        eq(closeoutCounters.organizationId, input.organizationId),
        eq(closeoutCounters.sequenceYear, input.year),
      ),
    )
    .returning({ lastSeq: closeoutCounters.lastSeq });

  if (bumped.length > 0) {
    return bumped[0].lastSeq;
  }

  // No row yet — insert it. On the (improbable) race where another txn
  // inserts between our UPDATE (returning 0) and this INSERT, the unique
  // constraint fires and the caller retries.
  const [inserted] = await dbc
    .insert(closeoutCounters)
    .values({
      organizationId: input.organizationId,
      sequenceYear: input.year,
      lastSeq: 1,
    })
    .returning({ lastSeq: closeoutCounters.lastSeq });
  return inserted.lastSeq;
}
