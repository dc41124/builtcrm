// Seed data for Step 24.5 reports that don't yet have a backing loader.
// Each dataset is sized to make the visualizations read naturally.
// As each underlying module ships (see build guide wiring notes), the
// corresponding array is replaced with a real loader — one report at a time.

export type SeedProject = {
  id: number;
  name: string;
  phase: string;
  client: string;
  contract: number;
  co: number;
  costToDate: number;
  estTotalCost: number;
  billed: number;
};

export const SEED_PROJECTS: SeedProject[] = [
  {
    id: 1,
    name: "Meridian Tower Renovation",
    phase: "phase_2",
    client: "Meridian Holdings LLC",
    contract: 4800000,
    co: 125000,
    costToDate: 2150000,
    estTotalCost: 4200000,
    billed: 1900000,
  },
  {
    id: 2,
    name: "Harper Residence Kitchen Remodel",
    phase: "closeout",
    client: "Harper Family",
    contract: 185000,
    co: 12000,
    costToDate: 165000,
    estTotalCost: 175000,
    billed: 76000,
  },
  {
    id: 3,
    name: "Cascade Medical Clinic Fit-out",
    phase: "phase_1",
    client: "Cascade Health Partners",
    contract: 1200000,
    co: 45000,
    costToDate: 340000,
    estTotalCost: 1100000,
    billed: 473000,
  },
  {
    id: 4,
    name: "Harper Backyard ADU",
    phase: "phase_1",
    client: "Harper Family",
    contract: 340000,
    co: 0,
    costToDate: 125000,
    estTotalCost: 320000,
    billed: 141000,
  },
];

export type SeedArRow = {
  client: string;
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90p: number;
};

export const SEED_AR_BY_CLIENT: SeedArRow[] = [
  { client: "Meridian Holdings LLC", current: 180000, d1_30: 95000, d31_60: 42000, d61_90: 0, d90p: 0 },
  { client: "Cascade Health Partners", current: 125000, d1_30: 88000, d31_60: 30000, d61_90: 22000, d90p: 0 },
  { client: "Harper Family", current: 45000, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 },
  { client: "Northwind Properties", current: 0, d1_30: 0, d31_60: 0, d61_90: 18000, d90p: 12000 },
];

export const SEED_AR_TREND = [420, 445, 460, 498, 512, 478, 490, 520];

export type SeedJobCost = {
  id: number;
  name: string;
  budget: number;
  committed: number;
  actual: number;
  projected: number;
};

export const SEED_JOB_COST: SeedJobCost[] = [
  { id: 1, name: "Meridian Tower Renovation", budget: 4200000, committed: 3850000, actual: 2150000, projected: 4280000 },
  { id: 2, name: "Harper Residence Kitchen Remodel", budget: 175000, committed: 172000, actual: 165000, projected: 181000 },
  { id: 3, name: "Cascade Medical Clinic Fit-out", budget: 1100000, committed: 620000, actual: 340000, projected: 1085000 },
  { id: 4, name: "Harper Backyard ADU", budget: 320000, committed: 285000, actual: 125000, projected: 315000 },
];

export type SeedCashflow = { week: string; date: string; in: number; out: number };

export const SEED_CASHFLOW: SeedCashflow[] = [
  { week: "W17", date: "Apr 20", in: 285, out: 198 },
  { week: "W18", date: "Apr 27", in: 142, out: 225 },
  { week: "W19", date: "May 4", in: 420, out: 310 },
  { week: "W20", date: "May 11", in: 85, out: 245 },
  { week: "W21", date: "May 18", in: 380, out: 215 },
  { week: "W22", date: "May 25", in: 290, out: 268 },
  { week: "W23", date: "Jun 1", in: 510, out: 340 },
  { week: "W24", date: "Jun 8", in: 125, out: 285 },
  { week: "W25", date: "Jun 15", in: 460, out: 295 },
  { week: "W26", date: "Jun 22", in: 320, out: 250 },
  { week: "W27", date: "Jun 29", in: 395, out: 280 },
  { week: "W28", date: "Jul 6", in: 240, out: 310 },
];

export const SEED_STARTING_BALANCE = 450;

export type SeedLaborProject = {
  id: number;
  name: string;
  hoursActual: number;
  hoursBudget: number;
  costActual: number;
  costBudget: number;
  trades: {
    gc: number;
    electrical: number;
    plumbing: number;
    framing: number;
    hvac: number;
    other: number;
  };
};

export const SEED_LABOR_BY_PROJECT: SeedLaborProject[] = [
  {
    id: 1,
    name: "Meridian Tower Renovation",
    hoursActual: 8420,
    hoursBudget: 9200,
    costActual: 612000,
    costBudget: 680000,
    trades: { gc: 1820, electrical: 2100, plumbing: 1450, framing: 1600, hvac: 950, other: 500 },
  },
  {
    id: 2,
    name: "Harper Residence Kitchen Remodel",
    hoursActual: 960,
    hoursBudget: 880,
    costActual: 76000,
    costBudget: 68000,
    trades: { gc: 320, electrical: 180, plumbing: 160, framing: 140, hvac: 80, other: 80 },
  },
  {
    id: 3,
    name: "Cascade Medical Clinic Fit-out",
    hoursActual: 2180,
    hoursBudget: 2800,
    costActual: 168000,
    costBudget: 220000,
    trades: { gc: 520, electrical: 580, plumbing: 340, framing: 300, hvac: 280, other: 160 },
  },
  {
    id: 4,
    name: "Harper Backyard ADU",
    hoursActual: 680,
    hoursBudget: 720,
    costActual: 52000,
    costBudget: 56000,
    trades: { gc: 220, electrical: 120, plumbing: 100, framing: 140, hvac: 60, other: 40 },
  },
];

export const SEED_LABOR_TREND = [320, 345, 380, 362, 410, 395, 420, 445, 460, 440, 480, 495];

export type SeedSchedulePerf = {
  id: number;
  name: string;
  plannedStart: number;
  plannedEnd: number;
  actualStart: number;
  actualEnd: number;
  today: number;
  spi: number;
  milestonesHit: number;
  milestonesTotal: number;
};

export const SEED_SCHEDULE_PERF: SeedSchedulePerf[] = [
  { id: 1, name: "Meridian Tower Renovation", plannedStart: 5, plannedEnd: 85, actualStart: 5, actualEnd: 92, today: 48, spi: 0.91, milestonesHit: 7, milestonesTotal: 11 },
  { id: 2, name: "Harper Residence Kitchen Remodel", plannedStart: 25, plannedEnd: 68, actualStart: 28, actualEnd: 72, today: 70, spi: 0.96, milestonesHit: 9, milestonesTotal: 10 },
  { id: 3, name: "Cascade Medical Clinic Fit-out", plannedStart: 15, plannedEnd: 75, actualStart: 15, actualEnd: 70, today: 40, spi: 1.08, milestonesHit: 5, milestonesTotal: 9 },
  { id: 4, name: "Harper Backyard ADU", plannedStart: 20, plannedEnd: 78, actualStart: 22, actualEnd: 88, today: 45, spi: 0.82, milestonesHit: 3, milestonesTotal: 8 },
];

export type ComplianceSeverity = "critical" | "warning" | "ok";

export type SeedComplianceExpiring = {
  sub: string;
  doc: string;
  expires: string;
  days: number | null;
  sev: ComplianceSeverity;
};

export const SEED_COMPLIANCE_EXPIRING: SeedComplianceExpiring[] = [
  { sub: "Apex Electric", doc: "General Liability", expires: "May 3, 2026", days: 14, sev: "critical" },
  { sub: "Cornerstone Masonry", doc: "W-9", expires: "Missing", days: null, sev: "critical" },
  { sub: "Ridgeline Plumbing", doc: "Workers Comp", expires: "May 15, 2026", days: 26, sev: "warning" },
  { sub: "Summit Framing", doc: "Auto Insurance", expires: "May 22, 2026", days: 33, sev: "warning" },
  { sub: "Delta HVAC", doc: "Business License", expires: "Jun 30, 2026", days: 72, sev: "ok" },
];

export type ComplianceCell = "ok" | "expiring" | "warning" | "missing" | "n/a";

export type SeedSubMatrixRow = {
  name: string;
  trade: string;
  gl: ComplianceCell;
  wc: ComplianceCell;
  auto: ComplianceCell;
  bond: ComplianceCell;
  w9: ComplianceCell;
  license: ComplianceCell;
};

export const SEED_SUB_MATRIX: SeedSubMatrixRow[] = [
  { name: "Apex Electric", trade: "Electrical", gl: "expiring", wc: "ok", auto: "ok", bond: "n/a", w9: "ok", license: "ok" },
  { name: "Ridgeline Plumbing", trade: "Plumbing", gl: "ok", wc: "expiring", auto: "ok", bond: "n/a", w9: "ok", license: "ok" },
  { name: "Summit Framing", trade: "Framing", gl: "ok", wc: "ok", auto: "expiring", bond: "ok", w9: "ok", license: "ok" },
  { name: "Delta HVAC", trade: "HVAC", gl: "ok", wc: "ok", auto: "ok", bond: "ok", w9: "ok", license: "warning" },
  { name: "Cornerstone Masonry", trade: "Masonry", gl: "ok", wc: "ok", auto: "ok", bond: "ok", w9: "missing", license: "ok" },
];

export type SeedSavedReport = {
  id: number;
  name: string;
  type: string;
  scope: string;
  schedule: string;
  recipients: string[];
  lastRun: string;
  owner: string;
};

export const SEED_SAVED_REPORTS: SeedSavedReport[] = [
  { id: 1, name: "Monthly WIP Schedule", type: "WIP Schedule", scope: "All active projects", schedule: "Monthly · 1st", recipients: ["operations@summit.com", "cfo@summit.com"], lastRun: "Apr 1, 2026", owner: "Jamie P." },
  { id: 2, name: "Weekly AR Review", type: "AR Aging", scope: "All clients · 30+ days", schedule: "Weekly · Monday 7am", recipients: ["finance@summit.com"], lastRun: "Apr 14, 2026", owner: "Jamie P." },
  { id: 3, name: "Q2 Cost Overrun Watch", type: "Job Cost", scope: "Projects with variance > 5%", schedule: "Weekly · Friday", recipients: ["ops-leads@summit.com"], lastRun: "Apr 12, 2026", owner: "Rosa T." },
  { id: 4, name: "Compliance Expiration Digest", type: "Compliance", scope: "All subs · 60-day window", schedule: "Bi-weekly · Tuesday", recipients: ["compliance@summit.com"], lastRun: "Apr 8, 2026", owner: "Dev K." },
  { id: 5, name: "Cashflow 4-Week Lookahead", type: "Cashflow", scope: "4 weeks forward · portfolio", schedule: "Weekly · Friday", recipients: ["cfo@summit.com"], lastRun: "Apr 12, 2026", owner: "Jamie P." },
];
