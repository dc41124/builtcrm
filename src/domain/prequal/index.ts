// Public surface for prequalification actions. API routes import from
// here; nothing reaches into the individual files directly.

export { computeScore } from "./score";

export {
  archivePrequalTemplate,
  createPrequalTemplate,
  getActiveDraftSubmission,
  resolveDefaultTemplate,
  setDefaultPrequalTemplate,
  updatePrequalTemplate,
} from "./templates";

export {
  decidePrequalSubmission,
  inviteSubToPrequalify,
  moveSubmissionToUnderReview,
  savePrequalSubmissionDraft,
  submitPrequalSubmission,
  type DecidePrequalDecision,
} from "./submissions";

export {
  attachPrequalDocument,
  getPrequalDocumentDownloadUrl,
  removePrequalDocument,
  requestPrequalUploadUrl,
} from "./documents";

export {
  checkPrequalForAssignment,
  grantProjectExemption,
  recordPrequalOverride,
  revokeProjectExemption,
  setPrequalEnforcementMode,
  type CheckAssignmentResult,
} from "./enforcement";
