// Shared access check for drawing sheet mutations (markup, measurement,
// comment). Verifies the caller has a project context + the discipline
// gate (subs only see/write their own discipline) before any write. The
// loader's `getDrawingSheetDetail` does the same check on reads; writes
// can't reuse it because they operate on the sheet directly (not on a
// set-wide view).

import { and, eq, isNull, or } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import {
  drawingSets,
  drawingSheets,
  projectOrganizationMemberships,
} from "@/db/schema";
import {
  getEffectiveContext,
  type EffectiveContext,
  type SessionLike,
} from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

export type SheetAccess = {
  ctx: EffectiveContext;
  sheet: {
    id: string;
    setId: string;
    projectId: string;
    discipline: string | null;
  };
  scopeDiscipline: string | null;
};

export async function resolveSheetAccess(input: {
  session: SessionLike | null | undefined;
  sheetId: string;
}): Promise<SheetAccess> {
  // Pre-tenant head lookup: tenant unknown until project resolves.
  const [row] = await dbAdmin
    .select({
      sheetId: drawingSheets.id,
      setId: drawingSheets.setId,
      projectId: drawingSets.projectId,
      discipline: drawingSheets.discipline,
    })
    .from(drawingSheets)
    .innerJoin(drawingSets, eq(drawingSets.id, drawingSheets.setId))
    .where(eq(drawingSheets.id, input.sheetId))
    .limit(1);
  if (!row) {
    throw new AuthorizationError("sheet not found", "not_found");
  }

  const ctx = await getEffectiveContext(input.session, row.projectId);

  let scopeDiscipline: string | null = null;
  if (ctx.role === "subcontractor_user") {
    const [membership] = await withTenant(ctx.organization.id, (tx) =>
      tx
        .select({
          scope: projectOrganizationMemberships.scopeDiscipline,
        })
        .from(projectOrganizationMemberships)
        .where(
          and(
            eq(projectOrganizationMemberships.projectId, row.projectId),
            eq(
              projectOrganizationMemberships.organizationId,
              ctx.organization.id,
            ),
          ),
        )
        .limit(1),
    );
    scopeDiscipline = membership?.scope ?? null;
    // If the sub has a scope set AND the sheet discipline is out of it
    // (and not the null-wildcard), deny. The loader filters reads the
    // same way via SQL; here we gate the single-row mutation path.
    if (scopeDiscipline && row.discipline && row.discipline !== scopeDiscipline) {
      throw new AuthorizationError(
        "sheet is outside your discipline scope",
        "forbidden",
      );
    }
  }

  return {
    ctx,
    sheet: {
      id: row.sheetId,
      setId: row.setId,
      projectId: row.projectId,
      discipline: row.discipline,
    },
    scopeDiscipline,
  };
}

// Confirms a sheet id exists and is in scope WITHOUT caring about a
// particular resource/action — used by routes that already know the
// resource gate (e.g. 'drawing_markup', 'write') and just need the scope
// side of the check.
export async function assertSheetWriteScope(input: {
  session: SessionLike | null | undefined;
  sheetId: string;
}): Promise<SheetAccess> {
  const access = await resolveSheetAccess(input);
  // Re-assert discipline scope was respected. resolveSheetAccess throws
  // on violation already; this is just defense-in-depth + keeps callers
  // from forgetting. Narrow exception: discipline-scoped subs aren't
  // allowed to touch rows whose sheet.discipline is NULL *only if* their
  // scope is non-null AND the sheet is null — but the loader permits
  // reads of null-discipline sheets for scoped subs (cover sheets etc).
  // For writes we do the same: allow, so a sub can comment on a cover
  // sheet if relevant. Mirroring read scope simplifies reasoning.
  return access;
}

// Used by OR-filtered queries in a few places — convenience so loaders
// don't hand-roll the same `discipline = $scope OR discipline IS NULL`.
export function disciplineFilterClause(scope: string | null) {
  if (!scope) return undefined;
  return or(eq(drawingSheets.discipline, scope), isNull(drawingSheets.discipline));
}
