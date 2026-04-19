// Chart wrappers barrel.
//
// All recharts usage in the app MUST import from this directory.
// Rule: raw <BarChart> / <LineChart> etc. calls don't scatter across
// pages — if recharts ever needs to be replaced (Phase 4 already
// burned us on one abandoned viz library), the damage stays here.
//
// Each wrapper enforces the design-system defaults: DM Sans label
// fonts, portal-accent colors, consistent margins + grid style.
// Callers pass data + dimensions; they don't touch recharts types.

export { AgingBarChart } from "./AgingBarChart";
export type { AgingDatum } from "./AgingBarChart";
