// tax_id display masking. Mask format: `***-**-NNNN` where NNNN is the
// last 4 chars of the plaintext value. Values 4 chars or shorter mask
// in full (no separators).
//
// Used by:
//   - src/domain/loaders/organization-profile.ts (renders the mask in
//     the OrganizationProfile.taxId field for read paths)
//   - src/app/api/org/profile/route.ts (detects mask-shape in PATCH
//     submissions to skip re-encryption when the form was not edited)
//
// See docs/specs/tax_id_encryption_plan.md for the rationale.

export function maskTaxId(plaintext: string): string {
  if (!plaintext) return "";
  if (plaintext.length <= 4) return "*".repeat(plaintext.length);
  return `***-**-${plaintext.slice(-4)}`;
}

// Heuristic: does this string look like the output of `maskTaxId`?
// Used to detect a Save-without-edit on the settings form so we don't
// re-encrypt the mask itself. Matches `***-**-NNNN` exactly OR a
// run of 1-4 asterisks (the short-value form).
export function looksLikeTaxIdMask(value: string): boolean {
  if (/^\*{1,4}$/.test(value)) return true;
  return /^\*{3}-\*{2}-.{4}$/.test(value);
}
