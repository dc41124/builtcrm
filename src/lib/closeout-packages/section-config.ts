// Section type → display config. Mirrors the JSX prototype
// (builtcrm_closeout_packages_module.jsx) so the UI, cover letter,
// and ZIP folder names stay consistent.

import type { CloseoutSectionType } from "@/domain/loaders/closeout-packages";

export type SectionConfig = {
  label: string;
  short: string;
  solid: string; // hex
  soft: string; // rgba
  desc: string;
  // Folder prefix inside the ZIP. Kept short + lowercase with
  // underscores so unzip utilities don't choke.
  folderSlug: string;
};

export const SECTION_CONFIG: Record<CloseoutSectionType, SectionConfig> = {
  om_manuals: {
    label: "O&M Manuals",
    short: "O&M",
    solid: "#5b4fc7",
    soft: "rgba(91,79,199,.12)",
    desc: "Operations & maintenance manuals for installed equipment.",
    folderSlug: "om_manuals",
  },
  warranties: {
    label: "Warranties",
    short: "Warranty",
    solid: "#2d8a5e",
    soft: "rgba(45,138,94,.12)",
    desc: "Manufacturer & contractor warranty certificates.",
    folderSlug: "warranties",
  },
  as_builts: {
    label: "As-Built Drawings",
    short: "As-Built",
    solid: "#3878a8",
    soft: "rgba(56,120,168,.12)",
    desc: "Final field-modified drawings reflecting actual install.",
    folderSlug: "as_builts",
  },
  permits_final: {
    label: "Final Permits & Approvals",
    short: "Permits",
    solid: "#c4700b",
    soft: "rgba(196,112,11,.12)",
    desc: "Closed permits, final inspection approvals, occupancy.",
    folderSlug: "permits_final",
  },
  testing_certificates: {
    label: "Testing & Commissioning",
    short: "T&C",
    solid: "#8a5b2a",
    soft: "rgba(138,91,42,.12)",
    desc: "Balancing reports, commissioning certs, test results.",
    folderSlug: "testing_certificates",
  },
  cad_files: {
    label: "CAD / BIM Files",
    short: "CAD",
    solid: "#5b7a6a",
    soft: "rgba(91,122,106,.12)",
    desc: "Native CAD/BIM source files for owner archive.",
    folderSlug: "cad_files",
  },
  other: {
    label: "Other",
    short: "Other",
    solid: "#6b5d8c",
    soft: "rgba(107,93,140,.12)",
    desc: "Custom section — contractor-defined.",
    folderSlug: "other",
  },
};

export function sectionLabelFor(
  sectionType: CloseoutSectionType,
  customLabel: string | null,
): string {
  if (sectionType === "other" && customLabel && customLabel.trim().length > 0) {
    return customLabel;
  }
  return SECTION_CONFIG[sectionType].label;
}

export function sectionFolderSlug(
  sectionType: CloseoutSectionType,
  customLabel: string | null,
  index: number,
): string {
  const base = SECTION_CONFIG[sectionType].folderSlug;
  if (sectionType === "other" && customLabel) {
    const cleaned = customLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    return `${String(index).padStart(2, "0")}_other_${cleaned || index}`;
  }
  return `${String(index).padStart(2, "0")}_${base}`;
}
