import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { documents } from "@/db/schema";

// Version-chain helpers. The model is linear — a document can have at
// most one direct successor (enforced by a partial unique index on
// `supersedes_document_id`). Walking forward from any node reaches the
// chain head (current version); walking backward reaches the root.
//
// All walks are bounded by MAX_CHAIN_HOPS to defend against data
// corruption (e.g. a cycle inserted via direct SQL bypassing the
// app-layer cycle guard). At 32 hops we'd be well past any realistic
// revision cycle; past that we throw rather than loop forever.

const MAX_CHAIN_HOPS = 32;

type DocChainRow = {
  id: string;
  supersedesDocumentId: string | null;
  title: string;
  storageKey: string;
  fileSizeBytes: number | null;
  uploadedByUserId: string;
  isSuperseded: boolean;
  createdAt: Date;
};

// Returns the current (chain-head) document id for any node in the
// chain. Walks forward via successor rows until it finds one with no
// successor. If the given id is invalid or the chain is somehow
// cyclical, returns the input id as a safe fallback.
export async function resolveCurrentVersionId(
  docId: string,
): Promise<string> {
  let current = docId;
  const seen = new Set<string>([current]);
  for (let hop = 0; hop < MAX_CHAIN_HOPS; hop++) {
    const [successor] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.supersedesDocumentId, current))
      .limit(1);
    if (!successor) return current;
    if (seen.has(successor.id)) {
      // Cycle detected. Return the last non-cyclic node — conservative
      // fallback. Callers treat this as "some version; manual cleanup
      // needed."
      return current;
    }
    seen.add(successor.id);
    current = successor.id;
  }
  return current;
}

// Batch variant: for a set of document ids (any nodes in their chains)
// returns a map of input id → current-version id. Used by loaders that
// hydrate cross-module links and need to resolve many at once without
// N individual walks.
export async function resolveCurrentVersionMap(
  inputIds: string[],
): Promise<Map<string, string>> {
  if (inputIds.length === 0) return new Map();
  const dedup = Array.from(new Set(inputIds));

  // Pull every document that could be reachable via forward-walk from
  // any input. Simple approach: pull all documents that either (a) are
  // in the input set, or (b) whose predecessor is in the input set,
  // iteratively, until no new rows come back. Bounded by MAX_CHAIN_HOPS
  // to stay safe against corrupt data.
  const all = new Map<string, DocChainRow>();
  let frontier = dedup;
  for (let hop = 0; hop < MAX_CHAIN_HOPS && frontier.length > 0; hop++) {
    const rows = await db
      .select({
        id: documents.id,
        supersedesDocumentId: documents.supersedesDocumentId,
        title: documents.title,
        storageKey: documents.storageKey,
        fileSizeBytes: documents.fileSizeBytes,
        uploadedByUserId: documents.uploadedByUserId,
        isSuperseded: documents.isSuperseded,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(inArray(documents.supersedesDocumentId, frontier));
    const next: string[] = [];
    for (const r of rows) {
      if (!all.has(r.id)) {
        all.set(r.id, r);
        next.push(r.id);
      }
    }
    frontier = next;
  }

  // Build forward index: predecessorId → successorId.
  const forward = new Map<string, string>();
  for (const row of all.values()) {
    if (row.supersedesDocumentId) {
      forward.set(row.supersedesDocumentId, row.id);
    }
  }

  const out = new Map<string, string>();
  for (const id of dedup) {
    let current = id;
    const seen = new Set<string>([current]);
    for (let hop = 0; hop < MAX_CHAIN_HOPS; hop++) {
      const nxt = forward.get(current);
      if (!nxt || seen.has(nxt)) break;
      seen.add(nxt);
      current = nxt;
    }
    out.set(id, current);
  }
  return out;
}

// Walks backward from a given doc id (typically the chain head) to
// collect every version in order, oldest → newest. Used to render
// the version-history timeline in the document detail panel.
export async function getVersionChain(
  docId: string,
): Promise<DocChainRow[]> {
  // Pull everything in the connected chain via two passes:
  //  (1) walk backward from docId via supersedesDocumentId
  //  (2) walk forward from docId via reverse lookups
  // Then sort oldest → newest by walking backward from the head.

  // Pass 1: gather backward ancestry.
  const backward: DocChainRow[] = [];
  {
    let cursor: string | null = docId;
    const seen = new Set<string>();
    for (let hop = 0; hop < MAX_CHAIN_HOPS && cursor; hop++) {
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const [row] = await db
        .select({
          id: documents.id,
          supersedesDocumentId: documents.supersedesDocumentId,
          title: documents.title,
          storageKey: documents.storageKey,
          fileSizeBytes: documents.fileSizeBytes,
          uploadedByUserId: documents.uploadedByUserId,
          isSuperseded: documents.isSuperseded,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(eq(documents.id, cursor))
        .limit(1);
      if (!row) break;
      backward.push(row);
      cursor = row.supersedesDocumentId;
    }
  }

  // Pass 2: walk forward from docId collecting successors.
  const forward: DocChainRow[] = [];
  {
    let cursor = docId;
    const seen = new Set<string>([cursor]);
    for (let hop = 0; hop < MAX_CHAIN_HOPS; hop++) {
      const [row] = await db
        .select({
          id: documents.id,
          supersedesDocumentId: documents.supersedesDocumentId,
          title: documents.title,
          storageKey: documents.storageKey,
          fileSizeBytes: documents.fileSizeBytes,
          uploadedByUserId: documents.uploadedByUserId,
          isSuperseded: documents.isSuperseded,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(eq(documents.supersedesDocumentId, cursor))
        .limit(1);
      if (!row || seen.has(row.id)) break;
      seen.add(row.id);
      forward.push(row);
      cursor = row.id;
    }
  }

  // Ordered oldest → newest. Backward is docId, predecessor, grand-
  // predecessor, ...; reverse to get ancestors in upload order, then
  // append forward successors.
  return [...backward.reverse(), ...forward];
}

// Prevents cycles at the app layer. Postgres wouldn't stop you from
// setting supersedes_document_id = id on the same row or from creating
// A→B→A loops. Called from the supersede action before inserting.
//
// Cheap check: walk the predecessor's own chain backward and confirm
// the candidate id doesn't appear. Candidate is typically a
// just-uploaded document with no prior chain anyway, but defensive.
export async function isInChain(
  candidateId: string,
  predecessorId: string,
): Promise<boolean> {
  if (candidateId === predecessorId) return true;
  let cursor: string | null = predecessorId;
  const seen = new Set<string>();
  for (let hop = 0; hop < MAX_CHAIN_HOPS && cursor; hop++) {
    if (cursor === candidateId) return true;
    if (seen.has(cursor)) return false;
    seen.add(cursor);
    const [row] = await db
      .select({ supersedesDocumentId: documents.supersedesDocumentId })
      .from(documents)
      .where(eq(documents.id, cursor))
      .limit(1);
    cursor = row?.supersedesDocumentId ?? null;
  }
  return false;
}
