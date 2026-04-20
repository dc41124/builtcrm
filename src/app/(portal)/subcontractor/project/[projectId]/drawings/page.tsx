// Subcontractor drawings — list view. Thin mirror of the contractor page
// because the sets-level view is identical for both (sub-scoped filtering
// happens at the sheet-index / sheet-detail level). Re-exporting the
// contractor page lets us share one implementation; portal link paths are
// derived by the workspace components from the role in the loader result.

export { default } from "@/app/(portal)/contractor/project/[projectId]/drawings/page";
