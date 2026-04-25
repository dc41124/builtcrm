import {
  getActivePrequalForPair,
  type PrequalBadgeStatus,
} from "@/domain/loaders/prequal";

// Server component. Reads active prequal status for a (contractor, sub)
// pair via the memoized loader and renders a status pill. Multiple
// instances on the same page hit the DB once per pair (react.cache).

const LABEL: Record<PrequalBadgeStatus, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  expired: "Expired",
  none: "Not started",
};

function fmtExpiry(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function PrequalBadge({
  contractorOrgId,
  subOrgId,
  size = "md",
  showExpiry = true,
}: {
  contractorOrgId: string;
  subOrgId: string;
  size?: "sm" | "md" | "lg";
  showExpiry?: boolean;
}) {
  const active = await getActivePrequalForPair(contractorOrgId, subOrgId);
  const className = `pq-badge ${active.status}${size === "lg" ? " lg" : ""}`;
  return (
    <span className={className} aria-label={`Prequal: ${LABEL[active.status]}`}>
      {LABEL[active.status]}
      {showExpiry &&
      active.status === "approved" &&
      active.expiresAt &&
      size !== "sm" ? (
        <span className="pq-badge-meta">
          · expires {fmtExpiry(active.expiresAt)}
        </span>
      ) : null}
    </span>
  );
}
