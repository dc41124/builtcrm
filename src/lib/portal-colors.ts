/**
 * Shared portal accent color palette.
 *
 * Every portal-aware UI component should import from here instead of
 * defining its own color map. The type contains the superset of all
 * properties needed by AppShell, MessagesWorkspace, DocumentsWorkspace,
 * and ScheduleView.
 */

export type PortalType = "contractor" | "subcontractor" | "commercial" | "residential";

export type PortalAccent = {
  ac: string;   // base accent
  ach: string;  // accent hover
  acs: string;  // accent surface/background
  act: string;  // accent text
  acm: string;  // accent muted
  acl: string;  // accent light
  ri: string;   // ring/focus color
};

export const PORTAL_ACCENTS: Record<PortalType, PortalAccent> = {
  contractor: {
    ac: "#5b4fc7",
    ach: "#4f44b3",
    acs: "#eeedfb",
    act: "#4a3fb0",
    acm: "#c7c2ea",
    acl: "#7c6fe0",
    ri: "rgba(91,79,199,.15)",
  },
  subcontractor: {
    ac: "#3d6b8e",
    ach: "#345d7c",
    acs: "#e8f0f6",
    act: "#2e5a78",
    acm: "#b3cede",
    acl: "#5c8bae",
    ri: "rgba(61,107,142,.15)",
  },
  commercial: {
    ac: "#3178b9",
    ach: "#296aa6",
    acs: "#e8f1fa",
    act: "#276299",
    acm: "#b0cfe8",
    acl: "#5a94cc",
    ri: "rgba(49,120,185,.15)",
  },
  residential: {
    ac: "#2a7f6f",
    ach: "#237060",
    acs: "#e6f5f1",
    act: "#1f6b5d",
    acm: "#a8d5ca",
    acl: "#4aa291",
    ri: "rgba(42,127,111,.15)",
  },
};
