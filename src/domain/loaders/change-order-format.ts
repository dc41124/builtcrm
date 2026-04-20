import type { PillColor } from "@/components/pill";

export function statusPill(status: string): PillColor {
  if (status === "approved") return "green";
  if (status === "rejected" || status === "voided") return "red";
  if (status === "pending_client_approval" || status === "pending_review")
    return "amber";
  return "gray";
}

export function formatStatus(s: string): string {
  if (s === "pending_client_approval") return "Pending approval";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

