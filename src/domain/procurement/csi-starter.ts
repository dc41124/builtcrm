// CSI MasterFormat division-level starter set. Intentionally limited to
// the ~25 divisions a typical GC actually touches — not the 500+ sub-
// codes. Contractors opt in via a first-run prompt on the procurement /
// cost-codes page; after opting in, they're expected to add custom
// sub-codes from there.
//
// Scoped to the current contractor org on seed; never global, never
// shared across orgs (different GCs use different coding schemes —
// MasterFormat, internal, government-custom).

export type CsiStarterCode = {
  code: string;
  description: string;
  sortOrder: number;
};

export const CSI_STARTER_CODES: CsiStarterCode[] = [
  { code: "01", description: "General Requirements", sortOrder: 10 },
  { code: "02", description: "Existing Conditions", sortOrder: 20 },
  { code: "03", description: "Concrete", sortOrder: 30 },
  { code: "04", description: "Masonry", sortOrder: 40 },
  { code: "05", description: "Metals", sortOrder: 50 },
  { code: "06", description: "Wood, Plastics & Composites", sortOrder: 60 },
  { code: "07", description: "Thermal & Moisture Protection", sortOrder: 70 },
  { code: "08", description: "Openings", sortOrder: 80 },
  { code: "09", description: "Finishes", sortOrder: 90 },
  { code: "10", description: "Specialties", sortOrder: 100 },
  { code: "11", description: "Equipment", sortOrder: 110 },
  { code: "12", description: "Furnishings", sortOrder: 120 },
  { code: "13", description: "Special Construction", sortOrder: 130 },
  { code: "14", description: "Conveying Equipment", sortOrder: 140 },
  { code: "21", description: "Fire Suppression", sortOrder: 210 },
  { code: "22", description: "Plumbing", sortOrder: 220 },
  { code: "23", description: "HVAC", sortOrder: 230 },
  { code: "25", description: "Integrated Automation", sortOrder: 250 },
  { code: "26", description: "Electrical", sortOrder: 260 },
  { code: "27", description: "Communications", sortOrder: 270 },
  { code: "28", description: "Electronic Safety & Security", sortOrder: 280 },
  { code: "31", description: "Earthwork", sortOrder: 310 },
  { code: "32", description: "Exterior Improvements", sortOrder: 320 },
  { code: "33", description: "Utilities", sortOrder: 330 },
];
