// Step 65 — privacy surface tokens. Plain constants, no React.
//
// Lives in its own module (rather than re-exported from privacy-shell)
// because privacy-shell is a "use client" boundary, and "use client"
// modules can only export React components and a small set of
// serializable values to Server Components — exporting plain objects
// like PRIVACY_F would fail the React Client Manifest with
// "Could not find the module" at build time.
//
// Both the "use client" wrappers (privacy-policy-ui, dsar-intake-ui,
// privacy-shell) and the Server Component pages (privacy/officer)
// import from here.

export const PRIVACY_F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
} as const;

export type PrivacyTab = "policy" | "officer" | "dsar";
