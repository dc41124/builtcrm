import type { EffectiveRole } from "./context";

// Every resource a loader or action can touch. Keep this list narrow and
// explicit — adding a resource here forces an intentional policy decision
// instead of silently defaulting to "allow".
export type Resource =
  | "project"
  | "document"
  | "rfi"
  | "submittal"
  | "change_order"
  | "milestone"
  | "schedule"
  | "sov"
  | "draw_request"
  | "lien_waiver"
  | "invoice"
  | "selection"
  | "conversation"
  | "message"
  | "membership"
  | "invitation"
  | "audit_log"
  | "drawing"
  | "drawing_markup"
  // Subcontractor prequalification (Step 49). Three resources covering the
  // template lifecycle, the submission lifecycle, and the org-level
  // enforcement-mode setting. Per-row org scoping (actor's org ==
  // submittedByOrgId / contractorOrgId, etc.) is enforced inside each
  // action handler — the coarse role gate lives here.
  | "prequal_template"
  | "prequal_submission"
  | "prequal_enforcement_settings";

export type Action = "read" | "write" | "approve";

type Policy = Partial<Record<Action, ReadonlySet<EffectiveRole>>>;

const ALL_CONTRACTOR: ReadonlySet<EffectiveRole> = new Set([
  "contractor_admin",
  "contractor_pm",
]);

const EVERYONE: ReadonlySet<EffectiveRole> = new Set([
  "contractor_admin",
  "contractor_pm",
  "subcontractor_user",
  "commercial_client",
  "residential_client",
]);

const CLIENTS: ReadonlySet<EffectiveRole> = new Set([
  "commercial_client",
  "residential_client",
]);

// Resource-level policy. Project-level overrides (phase/work scope) in
// project_user_memberships narrow these further at query time; this map is
// the coarse gate every loader hits first.
const POLICY: Record<Resource, Policy> = {
  project: { read: EVERYONE, write: ALL_CONTRACTOR },
  document: {
    read: EVERYONE,
    // Clients can upload their own docs (insurance, tax exemptions, etc.).
    // Per-doc ownership is enforced inside each API endpoint — clients can
    // only edit/supersede/archive docs they uploaded themselves.
    write: new Set([...ALL_CONTRACTOR, "subcontractor_user", ...CLIENTS]),
  },
  rfi: {
    read: EVERYONE,
    write: new Set([...ALL_CONTRACTOR, "subcontractor_user"]),
    approve: new Set([...ALL_CONTRACTOR, ...CLIENTS]),
  },
  submittal: {
    read: EVERYONE,
    write: new Set([...ALL_CONTRACTOR, "subcontractor_user"]),
    approve: new Set([...ALL_CONTRACTOR, "commercial_client"]),
  },
  change_order: {
    read: EVERYONE,
    write: ALL_CONTRACTOR,
    approve: new Set([...ALL_CONTRACTOR, ...CLIENTS]),
  },
  milestone: { read: EVERYONE, write: ALL_CONTRACTOR },
  schedule: { read: EVERYONE, write: ALL_CONTRACTOR },
  sov: { read: ALL_CONTRACTOR, write: ALL_CONTRACTOR },
  draw_request: {
    read: new Set([...ALL_CONTRACTOR, ...CLIENTS, "subcontractor_user"]),
    write: ALL_CONTRACTOR,
    approve: CLIENTS,
  },
  lien_waiver: {
    read: new Set([...ALL_CONTRACTOR, "subcontractor_user"]),
    write: new Set([...ALL_CONTRACTOR, "subcontractor_user"]),
  },
  invoice: {
    read: new Set([...ALL_CONTRACTOR, ...CLIENTS]),
    write: ALL_CONTRACTOR,
  },
  selection: {
    read: new Set([...ALL_CONTRACTOR, "residential_client"]),
    write: new Set([...ALL_CONTRACTOR, "residential_client"]),
    approve: new Set([...ALL_CONTRACTOR, "residential_client"]),
  },
  conversation: { read: EVERYONE, write: EVERYONE },
  message: { read: EVERYONE, write: EVERYONE },
  membership: { read: ALL_CONTRACTOR, write: ALL_CONTRACTOR },
  invitation: { read: ALL_CONTRACTOR, write: ALL_CONTRACTOR },
  audit_log: { read: ALL_CONTRACTOR },
  // Drawing sets + sheets: contractor staff manage uploads and version
  // chains; subs + clients view. Per-project sub scoping (show only the
  // discipline the sub is on) lives in the loader, not here.
  drawing: { read: EVERYONE, write: ALL_CONTRACTOR },
  // Per-user annotations on sheets (markup vectors, measurements, pinned
  // comments). Subs can annotate sheets in their scope; contractors can
  // annotate any sheet. Per-row ownership (a user can only mutate their
  // own markup/comment row) is enforced inside each endpoint — the coarse
  // gate here just admits the role to the resource.
  drawing_markup: {
    read: EVERYONE,
    write: new Set([...ALL_CONTRACTOR, "subcontractor_user"]),
  },
  // Subcontractor prequalification templates. Contractor org admins manage
  // them (CRUD). Contractor PMs can read so review surfaces can render the
  // active template alongside a submission. Subs see template content only
  // through the form they're filling — the loader scopes that read.
  prequal_template: {
    read: ALL_CONTRACTOR,
    write: new Set(["contractor_admin"]),
  },
  // Submissions. Subs write (fill + save draft + submit) on their own org's
  // behalf. Contractor admins and PMs read for review and write reviewer
  // notes on existing rows; only those two roles `approve`. Per-row org
  // scoping (actor.org == submittedByOrgId for sub writes,
  // actor.org == contractorOrgId for contractor reads/approvals) is
  // enforced inside the action handlers — the coarse gate here only
  // restricts by role.
  prequal_submission: {
    read: new Set([...ALL_CONTRACTOR, "subcontractor_user"]),
    write: new Set([...ALL_CONTRACTOR, "subcontractor_user"]),
    approve: ALL_CONTRACTOR,
  },
  // Org-level enforcement-mode setting (warn / block / off) plus per-project
  // exemptions. Only contractor admins configure; PMs read so the warn /
  // block banners render correctly during assignment.
  prequal_enforcement_settings: {
    read: ALL_CONTRACTOR,
    write: new Set(["contractor_admin"]),
  },
};

export type Permissions = {
  can: (resource: Resource, action: Action) => boolean;
};

export function buildPermissions(role: EffectiveRole): Permissions {
  return {
    can(resource, action) {
      return POLICY[resource][action]?.has(role) ?? false;
    },
  };
}

export function assertCan(
  permissions: Permissions,
  resource: Resource,
  action: Action,
): void {
  if (!permissions.can(resource, action)) {
    throw new AuthorizationError(
      `Not permitted to ${action} ${resource}`,
      "forbidden",
    );
  }
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly code: "unauthenticated" | "forbidden" | "not_found",
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}
