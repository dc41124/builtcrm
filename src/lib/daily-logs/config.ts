// Daily-log configuration constants. Kept in one place so the edit
// window rule can be adjusted without grepping the repo.

// How long after submittedAt the author may continue to edit the log
// in place. After this window, further edits must route through the
// daily_log_amendments workflow.
export const EDIT_WINDOW_HOURS = 24;

export function computeEditWindowClosesAt(submittedAt: Date): Date {
  return new Date(submittedAt.getTime() + EDIT_WINDOW_HOURS * 60 * 60 * 1000);
}

export function isWithinEditWindow(
  editWindowClosesAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!editWindowClosesAt) return true; // draft, never submitted
  return now < editWindowClosesAt;
}
