import { useState, useMemo } from 'react';
import {
  LayoutDashboard, TrendingUp, Receipt, Wallet, Calculator,
  Users, CalendarClock, ShieldCheck, Bookmark, Download,
  ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2, Clock, FileText,
  Search, Plus, Mail, MoreHorizontal, Minus, ArrowLeft, Star, ChevronRight,
  FileBarChart, Truck, Hammer, Scale, Gavel, ClipboardCheck, PackageCheck,
  DollarSign, History, Palette
} from 'lucide-react';

// BuiltCRM — Contractor Reports Page V4
// Landing hub + 24 reports + sharp/hairline-based visual language.
// All state is in-memory React state — search, starring, navigation, recent-tracking are fully wired.
// All charts are hand-coded inline SVG, hairline-first, no runtime chart library.
// Design target: Bloomberg/Stripe/Linear aesthetic — data-dense, sophisticated, no toy colors.

// ==================== REPORTS CATALOG ====================
// Every report surface that will exist by end of Phase 4+.
// `built: true` = implemented in this prototype; `built: false` = stub with roadmap note.

const CATEGORIES = [
  { id: 'financial', label: 'Financial', icon: TrendingUp, blurb: 'Billing, cash, and cost performance' },
  { id: 'operational', label: 'Operational', icon: CalendarClock, blurb: 'Project health, schedule, field activity' },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck, blurb: 'Documents, qualifications, and audit trail' },
  { id: 'tax_legal', label: 'Tax & Legal', icon: Scale, blurb: 'Canadian tax forms and statutory ledgers' },
  { id: 'residential', label: 'Residential', icon: Palette, blurb: 'Custom-home specific surfaces' },
  { id: 'library', label: 'Library', icon: Bookmark, blurb: 'Saved filter sets and scheduled deliveries' },
];

const REPORTS = [
  { id: 'overview', category: 'operational', label: 'Portfolio Overview', icon: LayoutDashboard, desc: 'KPIs and aging at a glance', built: true, origin: 'Step 24' },
  { id: 'wip', category: 'financial', label: 'WIP Schedule', icon: TrendingUp, desc: 'Over/under billing position', built: true, origin: 'Step 24.5' },
  { id: 'ar', category: 'financial', label: 'AR Aging', icon: Receipt, desc: 'Unpaid invoices by age', built: true, origin: 'Step 24.5' },
  { id: 'cost', category: 'financial', label: 'Job Cost', icon: Calculator, desc: 'Budget vs committed vs actual vs projected', built: true, origin: 'Step 24.5' },
  { id: 'cashflow', category: 'financial', label: 'Cashflow Projection', icon: Wallet, desc: '12-week inflow, outflow, and balance forecast', built: true, origin: 'Step 24.5' },
  { id: 'payments', category: 'financial', label: 'Payment Tracking', icon: DollarSign, desc: 'Inbound draws and outbound sub payments', built: false, origin: 'Step 38' },
  { id: 'labor', category: 'operational', label: 'Labor & Productivity', icon: Users, desc: 'Hours and labor cost by project and trade', built: true, origin: 'Step 24.5' },
  { id: 'schedule', category: 'operational', label: 'Schedule Performance', icon: CalendarClock, desc: 'SPI and planned-vs-actual timeline', built: true, origin: 'Step 24.5' },
  { id: 'daily-logs', category: 'operational', label: 'Daily Logs Rollup', icon: FileBarChart, desc: 'Cross-project daily log activity', built: false, origin: 'Phase 4B' },
  { id: 'weekly-reports', category: 'operational', label: 'Weekly Reports', icon: FileText, desc: 'Aggregated weekly progress reports', built: false, origin: 'Step 39' },
  { id: 'safety', category: 'operational', label: 'Safety Forms Summary', icon: ShieldCheck, desc: 'Toolbox talks, JHAs, incidents', built: false, origin: 'Step 52' },
  { id: 'time', category: 'operational', label: 'Time Tracking Rollup', icon: Clock, desc: 'Sub hours by project and crew', built: false, origin: 'Step 53' },
  { id: 'co-log', category: 'operational', label: 'Change Order Log', icon: Hammer, desc: 'All COs with status and aging', built: false, origin: 'Phase 4B' },
  { id: 'rfi-log', category: 'operational', label: 'RFI Log', icon: FileText, desc: 'All RFIs with turnaround times', built: false, origin: 'Phase 4B' },
  { id: 'submittal-log', category: 'operational', label: 'Submittal Log', icon: PackageCheck, desc: 'Submittal status and reviewer activity', built: false, origin: 'Step 20' },
  { id: 'procurement', category: 'operational', label: 'Procurement / POs', icon: Truck, desc: 'POs by vendor, status, and aging', built: false, origin: 'Step 41' },
  { id: 'inspections', category: 'operational', label: 'Inspections Summary', icon: ClipboardCheck, desc: 'QA/QC pass-fail trends', built: false, origin: 'Step 45' },
  { id: 'closeout', category: 'operational', label: 'Closeout Matrix', icon: PackageCheck, desc: 'Closeout completion per project', built: false, origin: 'Step 48' },
  { id: 'compliance', category: 'compliance', label: 'Compliance', icon: ShieldCheck, desc: 'Expiring documents and sub matrix', built: true, origin: 'Step 24.5' },
  { id: 'prequal', category: 'compliance', label: 'Subcontractor Prequalification', icon: CheckCircle2, desc: 'Qualification status across subs', built: false, origin: 'Step 49' },
  { id: 'audit', category: 'compliance', label: 'Audit Log', icon: History, desc: 'System event history with filters', built: false, origin: 'Phase 8-lite' },
  { id: 'lien-waivers', category: 'compliance', label: 'Lien Waiver Log', icon: FileText, desc: 'Waiver status per draw and sub', built: false, origin: 'Step 40' },
  { id: 't5018', category: 'tax_legal', label: 'T5018 Tax Slips', icon: Scale, desc: 'Annual CRA slip generator', built: false, origin: 'Step 67' },
  { id: 'holdback', category: 'tax_legal', label: 'Holdback Ledger', icon: Gavel, desc: 'Ontario Construction Act tracking', built: false, origin: 'Step 68' },
  { id: 'allowances', category: 'residential', label: 'Allowance Balance', icon: Palette, desc: 'Running balance across allowances', built: false, origin: 'Step 74' },
  { id: 'saved', category: 'library', label: 'Saved Reports', icon: Bookmark, desc: 'Named filter sets and scheduled deliveries', built: true, origin: 'Step 24.5' },
];

// ==================== SEED DATA ====================

const COMPANY = { name: 'Summit Contracting', projectCount: 4, lastUpdated: 'Apr 19, 2026 · 1:15 AM' };

const PROJECTS = [
  { id: 1, name: 'Meridian Tower Renovation', phase: 'phase_2', client: 'Meridian Holdings LLC', contract: 4800000, co: 125000, costToDate: 2150000, estTotalCost: 4200000, billed: 1900000 },
  { id: 2, name: 'Harper Residence Kitchen Remodel', phase: 'closeout', client: 'Harper Family', contract: 185000, co: 12000, costToDate: 165000, estTotalCost: 175000, billed: 76000 },
  { id: 3, name: 'Cascade Medical Clinic Fit-out', phase: 'phase_1', client: 'Cascade Health Partners', contract: 1200000, co: 45000, costToDate: 340000, estTotalCost: 1100000, billed: 473000 },
  { id: 4, name: 'Harper Backyard ADU', phase: 'phase_1', client: 'Harper Family', contract: 340000, co: 0, costToDate: 125000, estTotalCost: 320000, billed: 141000 },
];

const AR_BY_CLIENT = [
  { client: 'Meridian Holdings LLC', current: 180000, d1_30: 95000, d31_60: 42000, d61_90: 0, d90p: 0 },
  { client: 'Cascade Health Partners', current: 125000, d1_30: 88000, d31_60: 30000, d61_90: 22000, d90p: 0 },
  { client: 'Harper Family', current: 45000, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 },
  { client: 'Northwind Properties', current: 0, d1_30: 0, d31_60: 0, d61_90: 18000, d90p: 12000 },
];
const AR_TREND = [420, 445, 460, 498, 512, 478, 490, 520];

const JOB_COST = [
  { id: 1, name: 'Meridian Tower Renovation', budget: 4200000, committed: 3850000, actual: 2150000, projected: 4280000 },
  { id: 2, name: 'Harper Residence Kitchen Remodel', budget: 175000, committed: 172000, actual: 165000, projected: 181000 },
  { id: 3, name: 'Cascade Medical Clinic Fit-out', budget: 1100000, committed: 620000, actual: 340000, projected: 1085000 },
  { id: 4, name: 'Harper Backyard ADU', budget: 320000, committed: 285000, actual: 125000, projected: 315000 },
];

const CASHFLOW = [
  { week: 'W17', date: 'Apr 20', in: 285, out: 198 },
  { week: 'W18', date: 'Apr 27', in: 142, out: 225 },
  { week: 'W19', date: 'May 4',  in: 420, out: 310 },
  { week: 'W20', date: 'May 11', in: 85,  out: 245 },
  { week: 'W21', date: 'May 18', in: 380, out: 215 },
  { week: 'W22', date: 'May 25', in: 290, out: 268 },
  { week: 'W23', date: 'Jun 1',  in: 510, out: 340 },
  { week: 'W24', date: 'Jun 8',  in: 125, out: 285 },
  { week: 'W25', date: 'Jun 15', in: 460, out: 295 },
  { week: 'W26', date: 'Jun 22', in: 320, out: 250 },
  { week: 'W27', date: 'Jun 29', in: 395, out: 280 },
  { week: 'W28', date: 'Jul 6',  in: 240, out: 310 },
];
const STARTING_BALANCE = 450;

const LABOR_BY_PROJECT = [
  { id: 1, name: 'Meridian Tower Renovation', hoursActual: 8420, hoursBudget: 9200, costActual: 612000, costBudget: 680000,
    trades: { gc: 1820, electrical: 2100, plumbing: 1450, framing: 1600, hvac: 950, other: 500 } },
  { id: 2, name: 'Harper Residence Kitchen Remodel', hoursActual: 960, hoursBudget: 880, costActual: 76000, costBudget: 68000,
    trades: { gc: 320, electrical: 180, plumbing: 160, framing: 140, hvac: 80, other: 80 } },
  { id: 3, name: 'Cascade Medical Clinic Fit-out', hoursActual: 2180, hoursBudget: 2800, costActual: 168000, costBudget: 220000,
    trades: { gc: 520, electrical: 580, plumbing: 340, framing: 300, hvac: 280, other: 160 } },
  { id: 4, name: 'Harper Backyard ADU', hoursActual: 680, hoursBudget: 720, costActual: 52000, costBudget: 56000,
    trades: { gc: 220, electrical: 120, plumbing: 100, framing: 140, hvac: 60, other: 40 } },
];
const LABOR_TREND = [320, 345, 380, 362, 410, 395, 420, 445, 460, 440, 480, 495];

const SCHEDULE_PERF = [
  { id: 1, name: 'Meridian Tower Renovation', plannedStart: 5, plannedEnd: 85, actualStart: 5, actualEnd: 92, today: 48, spi: 0.91, milestonesHit: 7, milestonesTotal: 11 },
  { id: 2, name: 'Harper Residence Kitchen Remodel', plannedStart: 25, plannedEnd: 68, actualStart: 28, actualEnd: 72, today: 70, spi: 0.96, milestonesHit: 9, milestonesTotal: 10 },
  { id: 3, name: 'Cascade Medical Clinic Fit-out', plannedStart: 15, plannedEnd: 75, actualStart: 15, actualEnd: 70, today: 40, spi: 1.08, milestonesHit: 5, milestonesTotal: 9 },
  { id: 4, name: 'Harper Backyard ADU', plannedStart: 20, plannedEnd: 78, actualStart: 22, actualEnd: 88, today: 45, spi: 0.82, milestonesHit: 3, milestonesTotal: 8 },
];

const COMPLIANCE_EXPIRING = [
  { sub: 'Apex Electric', doc: 'General Liability', expires: 'May 3, 2026', days: 14, sev: 'critical' },
  { sub: 'Cornerstone Masonry', doc: 'W-9', expires: 'Missing', days: null, sev: 'critical' },
  { sub: 'Ridgeline Plumbing', doc: 'Workers Comp', expires: 'May 15, 2026', days: 26, sev: 'warning' },
  { sub: 'Summit Framing', doc: 'Auto Insurance', expires: 'May 22, 2026', days: 33, sev: 'warning' },
  { sub: 'Delta HVAC', doc: 'Business License', expires: 'Jun 30, 2026', days: 72, sev: 'ok' },
];

const SUB_MATRIX = [
  { name: 'Apex Electric', trade: 'Electrical', gl: 'expiring', wc: 'ok', auto: 'ok', bond: 'n/a', w9: 'ok', license: 'ok' },
  { name: 'Ridgeline Plumbing', trade: 'Plumbing', gl: 'ok', wc: 'expiring', auto: 'ok', bond: 'n/a', w9: 'ok', license: 'ok' },
  { name: 'Summit Framing', trade: 'Framing', gl: 'ok', wc: 'ok', auto: 'expiring', bond: 'ok', w9: 'ok', license: 'ok' },
  { name: 'Delta HVAC', trade: 'HVAC', gl: 'ok', wc: 'ok', auto: 'ok', bond: 'ok', w9: 'ok', license: 'warning' },
  { name: 'Cornerstone Masonry', trade: 'Masonry', gl: 'ok', wc: 'ok', auto: 'ok', bond: 'ok', w9: 'missing', license: 'ok' },
];

const SAVED_REPORTS = [
  { id: 1, name: 'Monthly WIP Schedule', type: 'WIP Schedule', scope: 'All active projects', schedule: 'Monthly · 1st', recipients: ['operations@summit.com', 'cfo@summit.com'], lastRun: 'Apr 1, 2026', owner: 'Jamie P.' },
  { id: 2, name: 'Weekly AR Review', type: 'AR Aging', scope: 'All clients · 30+ days', schedule: 'Weekly · Monday 7am', recipients: ['finance@summit.com'], lastRun: 'Apr 14, 2026', owner: 'Jamie P.' },
  { id: 3, name: 'Q2 Cost Overrun Watch', type: 'Job Cost', scope: 'Projects with variance > 5%', schedule: 'Weekly · Friday', recipients: ['ops-leads@summit.com'], lastRun: 'Apr 12, 2026', owner: 'Rosa T.' },
  { id: 4, name: 'Compliance Expiration Digest', type: 'Compliance', scope: 'All subs · 60-day window', schedule: 'Bi-weekly · Tuesday', recipients: ['compliance@summit.com'], lastRun: 'Apr 8, 2026', owner: 'Dev K.' },
  { id: 5, name: 'Cashflow 4-Week Lookahead', type: 'Cashflow', scope: '4 weeks forward · portfolio', schedule: 'Weekly · Friday', recipients: ['cfo@summit.com'], lastRun: 'Apr 12, 2026', owner: 'Jamie P.' },
];

// ==================== HELPERS ====================

const fmt = (n) => {
  if (n === 0) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}K`;
  return `${sign}$${abs}`;
};
const fmtK = (n) => (n === 0 ? '—' : `$${n}K`);
const fmtPct = (n) => `${Math.round(n * 100)}%`;
const fmtSigned = (n) => {
  if (n === 0) return '—';
  const abs = Math.abs(n);
  const prefix = n >= 0 ? '+' : '-';
  if (abs >= 1000000) return `${prefix}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${prefix}$${Math.round(abs / 1000)}K`;
  return `${prefix}$${abs}`;
};
const cn = (...xs) => xs.filter(Boolean).join(' ');

// ==================== APP SHELL ====================

export default function ReportsV4() {
  const [view, setView] = useState('landing'); // 'landing' | reportId
  const [starred, setStarred] = useState(new Set(['wip', 'ar', 'cashflow']));
  const [recent, setRecent] = useState(['cost', 'compliance', 'labor']);
  const [query, setQuery] = useState('');

  const openReport = (id) => {
    setRecent((prev) => [id, ...prev.filter((r) => r !== id)].slice(0, 6));
    setView(id);
    setQuery('');
  };
  const goLanding = () => setView('landing');
  const toggleStar = (id) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <div className="max-w-[1440px] mx-auto px-8 py-8">
        {view === 'landing' ? (
          <LandingHub
            starred={starred}
            recent={recent}
            query={query}
            setQuery={setQuery}
            openReport={openReport}
            toggleStar={toggleStar}
          />
        ) : (
          <ReportView
            reportId={view}
            starred={starred}
            toggleStar={toggleStar}
            goLanding={goLanding}
            openReport={openReport}
          />
        )}
      </div>
    </div>
  );
}

// ==================== LANDING HUB ====================

function LandingHub({ starred, recent, query, setQuery, openReport, toggleStar }) {
  const filtered = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return REPORTS.filter((r) => r.label.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q) || r.category.includes(q));
  }, [query]);

  const starredReports = REPORTS.filter((r) => starred.has(r.id));
  const recentReports = recent.map((id) => REPORTS.find((r) => r.id === id)).filter(Boolean);
  const reportsByCategory = CATEGORIES.map((c) => ({
    ...c,
    reports: REPORTS.filter((r) => r.category === c.id && r.id !== 'saved'),
  }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-semibold">{COMPANY.name} · {COMPANY.projectCount} projects</div>
          <h1 className="text-[26px] font-semibold text-slate-900 tracking-tight mt-0.5">Reports</h1>
          <div className="text-xs text-slate-500 mt-1">Data as of {COMPANY.lastUpdated}</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white ring-1 ring-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition">
            <Plus size={14} /> New saved report
          </button>
          <button className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center gap-1.5 transition">
            <Download size={14} /> Export portfolio PDF
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reports — try 'wip', 'cash', 'compliance', 't5018'..."
          className="w-full pl-11 pr-4 py-3 text-sm bg-white ring-1 ring-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 transition"
        />
      </div>

      {/* Filtered search results */}
      {filtered ? (
        <div>
          <SectionLabel>Results · {filtered.length}</SectionLabel>
          {filtered.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center bg-white ring-1 ring-slate-200 rounded-lg">
              No reports match "{query}"
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filtered.map((r) => (
                <ReportTile key={r.id} report={r} starred={starred.has(r.id)} onOpen={() => openReport(r.id)} onStar={() => toggleStar(r.id)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Starred */}
          {starredReports.length > 0 && (
            <div className="mb-8">
              <SectionLabel icon={Star}>Starred</SectionLabel>
              <div className="grid grid-cols-4 gap-3">
                {starredReports.map((r) => (
                  <ReportTile key={r.id} report={r} starred onOpen={() => openReport(r.id)} onStar={() => toggleStar(r.id)} compact />
                ))}
              </div>
            </div>
          )}

          {/* Recently viewed */}
          {recentReports.length > 0 && (
            <div className="mb-8">
              <SectionLabel icon={History}>Recently viewed</SectionLabel>
              <div className="grid grid-cols-4 gap-3">
                {recentReports.slice(0, 4).map((r) => (
                  <ReportTile key={r.id} report={r} starred={starred.has(r.id)} onOpen={() => openReport(r.id)} onStar={() => toggleStar(r.id)} compact />
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          <div className="mb-8">
            <SectionLabel>All reports</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              {reportsByCategory.map((c) => (
                <CategoryCard key={c.id} category={c} starred={starred} onOpen={openReport} onStar={toggleStar} />
              ))}
            </div>
          </div>

          {/* Saved reports preview */}
          <div>
            <SectionLabel>Saved & scheduled · {SAVED_REPORTS.length}</SectionLabel>
            <div className="bg-white ring-1 ring-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70 border-b border-slate-200">
                  <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                    <th className="text-left px-5 py-2.5 font-semibold">Name</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Type</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Schedule</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Last run</th>
                    <th className="text-right px-5 py-2.5 font-semibold">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {SAVED_REPORTS.slice(0, 4).map((r) => (
                    <tr key={r.id} onClick={() => openReport('saved')} className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition last:border-0">
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900 flex items-center gap-2">
                          <Bookmark size={13} className="text-indigo-500" fill="currentColor" />
                          {r.name}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-xs">{r.type}</td>
                      <td className="px-3 py-3 text-slate-600 text-xs">{r.schedule}</td>
                      <td className="px-3 py-3 text-slate-600 text-xs tabular-nums">{r.lastRun}</td>
                      <td className="px-5 py-3 text-right text-slate-600 text-xs">{r.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => openReport('saved')} className="w-full px-5 py-2.5 text-xs font-medium text-indigo-600 hover:bg-slate-50 flex items-center justify-center gap-1 transition border-t border-slate-100">
                View all saved reports <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SectionLabel({ children, icon: Icon }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      {Icon && <Icon size={13} className="text-slate-500" />}
      <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-slate-500">{children}</div>
    </div>
  );
}

function ReportTile({ report, starred, onOpen, onStar, compact }) {
  const Icon = report.icon;
  return (
    <div
      onClick={onOpen}
      className={cn(
        'group relative bg-white ring-1 ring-slate-200 rounded-lg cursor-pointer hover:ring-slate-300 hover:shadow-sm transition',
        compact ? 'p-3' : 'p-4',
        !report.built && 'opacity-75'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0', report.built ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500')}>
            <Icon size={15} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 truncate">{report.label}</div>
            {!compact && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{report.desc}</div>}
            {!report.built && (
              <div className="inline-flex items-center mt-1.5 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.06em] font-semibold bg-slate-100 text-slate-600">
                {report.origin}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStar();
          }}
          className={cn(
            'shrink-0 p-1 rounded hover:bg-slate-100 transition',
            starred ? 'text-amber-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'
          )}
        >
          <Star size={14} fill={starred ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}

function CategoryCard({ category, starred, onOpen, onStar }) {
  const Icon = category.icon;
  const builtCount = category.reports.filter((r) => r.built).length;
  return (
    <div className="bg-white ring-1 ring-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
          <Icon size={16} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900">{category.label}</div>
          <div className="text-xs text-slate-500 mt-0.5">{category.blurb}</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-slate-500 tabular-nums">
          {builtCount}/{category.reports.length}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {category.reports.map((r) => {
          const Ri = r.icon;
          const isStarred = starred.has(r.id);
          return (
            <div
              key={r.id}
              onClick={() => onOpen(r.id)}
              className={cn(
                'group px-5 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-slate-50/60 transition',
                !r.built && 'opacity-75'
              )}
            >
              <Ri size={14} className={cn('shrink-0', r.built ? 'text-slate-600' : 'text-slate-400')} strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900">{r.label}</div>
                <div className="text-xs text-slate-500 truncate">{r.desc}</div>
              </div>
              {!r.built && (
                <div className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.06em] font-semibold bg-slate-100 text-slate-600 tabular-nums">
                  {r.origin}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStar(r.id);
                }}
                className={cn(
                  'p-1 rounded hover:bg-slate-200 transition',
                  isStarred ? 'text-amber-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'
                )}
              >
                <Star size={12} fill={isStarred ? 'currentColor' : 'none'} />
              </button>
              <ChevronRight size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== REPORT VIEW SHELL ====================

function ReportView({ reportId, starred, toggleStar, goLanding, openReport }) {
  const report = REPORTS.find((r) => r.id === reportId);
  if (!report) return null;
  const siblings = REPORTS.filter((r) => r.category === report.category);
  const isStarred = starred.has(reportId);

  return (
    <div>
      {/* Top nav strip */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={goLanding} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition">
          <ArrowLeft size={15} /> All reports
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => toggleStar(reportId)} className={cn('p-1.5 rounded-md hover:bg-slate-100 transition', isStarred ? 'text-amber-500' : 'text-slate-400')}>
            <Star size={16} fill={isStarred ? 'currentColor' : 'none'} />
          </button>
          <button className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white ring-1 ring-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition">
            <Download size={14} /> Export PDF
          </button>
        </div>
      </div>

      {/* Report header */}
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-semibold">
          {CATEGORIES.find((c) => c.id === report.category)?.label} · {COMPANY.name}
        </div>
        <h1 className="text-[24px] font-semibold text-slate-900 tracking-tight mt-0.5">{report.label}</h1>
        <div className="text-sm text-slate-600 mt-1">{report.desc}</div>
      </div>

      {/* Sibling tabs — fast switch within category */}
      {siblings.length > 1 && (
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-0.5">
          {siblings.map((s) => (
            <button
              key={s.id}
              onClick={() => openReport(s.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition',
                s.id === reportId
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                !s.built && 'opacity-70'
              )}
            >
              {s.label}
              {!s.built && <span className="ml-1.5 text-[9px] uppercase tracking-[0.06em] opacity-70">· {s.origin}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Report content */}
      {report.built ? renderReport(reportId) : <UpcomingStub report={report} />}
    </div>
  );
}

function UpcomingStub({ report }) {
  return (
    <div className="bg-white ring-1 ring-slate-200 rounded-lg p-12 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-slate-100 text-slate-500 mb-4">
        <Clock size={20} />
      </div>
      <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-slate-500">Coming in {report.origin}</div>
      <div className="text-lg font-semibold text-slate-900 mt-1">{report.label}</div>
      <div className="text-sm text-slate-500 mt-2 max-w-md mx-auto">{report.desc}</div>
      <div className="text-xs text-slate-400 mt-6">Scheduled in the Phase 4+ build guide — see <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">docs/specs/phase_4plus_build_guide.md</span></div>
    </div>
  );
}

function renderReport(id) {
  switch (id) {
    case 'overview': return <OverviewReport />;
    case 'wip': return <WIPReport />;
    case 'ar': return <ARReport />;
    case 'cost': return <CostReport />;
    case 'cashflow': return <CashflowReport />;
    case 'labor': return <LaborReport />;
    case 'schedule': return <ScheduleReport />;
    case 'compliance': return <ComplianceReport />;
    case 'saved': return <SavedReportsView />;
    default: return null;
  }
}

// ==================== SHARED UI PRIMITIVES ====================

function Card({ children, className, padding = 'p-5' }) {
  return <div className={cn('bg-white ring-1 ring-slate-200 rounded-lg', padding, className)}>{children}</div>;
}

function SectionHeading({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-[14px] font-semibold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function KPI({ label, value, sub, trend, trendData, tone = 'neutral', icon: Icon }) {
  const tones = {
    neutral: '#6366f1',
    ok: '#059669',
    warn: '#d97706',
    crit: '#dc2626',
  };
  const color = tones[tone];
  const TrendIcon = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus;
  const trendColor = trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-600' : 'text-slate-400';

  return (
    <div className="bg-white ring-1 ring-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={13} className="text-slate-400" strokeWidth={2} />}
          <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-semibold">{label}</div>
        </div>
        {trend !== undefined && (
          <div className={cn('flex items-center gap-0.5 text-xs font-medium tabular-nums', trendColor)}>
            <TrendIcon size={11} strokeWidth={2.5} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[24px] font-semibold text-slate-900 tabular-nums leading-none tracking-tight">{value}</div>
          {sub && <div className="text-[11px] text-slate-500 mt-1.5">{sub}</div>}
        </div>
        {trendData && <Sparkline data={trendData} color={color} />}
      </div>
    </div>
  );
}

function Sparkline({ data, color = '#6366f1', height = 28, width = 80 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ==================== OVERVIEW (STUB) ====================

function OverviewReport() {
  return (
    <Card padding="p-8">
      <div className="text-center text-sm text-slate-500">
        Overview — the step 24 portfolio KPI dashboard lives here. Not redesigned in this prototype (it's what you already shipped).
      </div>
    </Card>
  );
}

// ==================== WIP SCHEDULE ====================

function WIPReport() {
  const rows = PROJECTS.map((p) => {
    const contractWithCO = p.contract + p.co;
    const pctComplete = p.costToDate / p.estTotalCost;
    const earned = contractWithCO * pctComplete;
    const overUnder = earned - p.billed;
    const backlog = contractWithCO - p.billed;
    return { ...p, contractWithCO, pctComplete, earned, overUnder, backlog };
  });
  const tot = rows.reduce(
    (a, r) => ({
      contractWithCO: a.contractWithCO + r.contractWithCO,
      costToDate: a.costToDate + r.costToDate,
      earned: a.earned + r.earned,
      billed: a.billed + r.billed,
      overUnder: a.overUnder + r.overUnder,
      backlog: a.backlog + r.backlog,
    }),
    { contractWithCO: 0, costToDate: 0, earned: 0, billed: 0, overUnder: 0, backlog: 0 }
  );

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <KPI label="Contract + COs" value={fmt(tot.contractWithCO)} icon={Wallet} trend={4.2} trendData={[6100, 6180, 6240, 6320, 6400, 6470, 6535, 6625]} />
        <KPI label="Earned Revenue" value={fmt(tot.earned)} sub={fmtPct(tot.earned / tot.contractWithCO) + ' of contract'} icon={TrendingUp} trend={8.1} trendData={[2800, 2920, 3050, 3190, 3280, 3410, 3520, 3640]} />
        <KPI label="Net Over/Under" value={fmtSigned(tot.overUnder)} sub={tot.overUnder > 0 ? 'Underbilled — catch up' : 'Overbilled — healthy'} tone={tot.overUnder > 0 ? 'warn' : 'ok'} icon={tot.overUnder > 0 ? AlertTriangle : CheckCircle2} />
        <KPI label="Backlog" value={fmt(tot.backlog)} sub="Contract remaining" icon={FileText} trend={-2.3} trendData={[4800, 4720, 4680, 4590, 4510, 4450, 4380, 4280]} />
      </div>

      <Card padding="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 border-b border-slate-200">
              <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                <th className="text-left px-5 py-3 font-semibold">Project</th>
                <th className="text-right px-3 py-3 font-semibold">Contract + COs</th>
                <th className="text-right px-3 py-3 font-semibold">Cost to Date</th>
                <th className="text-right px-3 py-3 font-semibold">% Complete</th>
                <th className="text-right px-3 py-3 font-semibold">Earned</th>
                <th className="text-right px-3 py-3 font-semibold">Billed</th>
                <th className="text-right px-3 py-3 font-semibold">Over / Under</th>
                <th className="text-right px-5 py-3 font-semibold">Backlog</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-900">{r.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{r.phase} · {r.client}</div>
                  </td>
                  <td className="text-right px-3 py-3.5 tabular-nums text-slate-900">{fmt(r.contractWithCO)}</td>
                  <td className="text-right px-3 py-3.5 tabular-nums text-slate-600">{fmt(r.costToDate)}</td>
                  <td className="text-right px-3 py-3.5">
                    <div className="inline-flex items-center gap-2 justify-end">
                      <div className="w-14 h-[3px] bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, r.pctComplete * 100)}%` }} />
                      </div>
                      <span className="tabular-nums text-slate-900 font-medium w-8 text-right">{fmtPct(r.pctComplete)}</span>
                    </div>
                  </td>
                  <td className="text-right px-3 py-3.5 tabular-nums text-slate-900">{fmt(r.earned)}</td>
                  <td className="text-right px-3 py-3.5 tabular-nums text-slate-900">{fmt(r.billed)}</td>
                  <td className={cn('text-right px-3 py-3.5 tabular-nums font-semibold', r.overUnder > 0 ? 'text-amber-700' : 'text-emerald-700')}>
                    {fmtSigned(r.overUnder)}
                  </td>
                  <td className="text-right px-5 py-3.5 tabular-nums text-slate-600">{fmt(r.backlog)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50/70 font-semibold">
                <td className="px-5 py-3 text-slate-600 text-[10px] uppercase tracking-[0.08em]">Totals</td>
                <td className="text-right px-3 py-3 tabular-nums">{fmt(tot.contractWithCO)}</td>
                <td className="text-right px-3 py-3 tabular-nums">{fmt(tot.costToDate)}</td>
                <td className="text-right px-3 py-3 tabular-nums text-slate-400">—</td>
                <td className="text-right px-3 py-3 tabular-nums">{fmt(tot.earned)}</td>
                <td className="text-right px-3 py-3 tabular-nums">{fmt(tot.billed)}</td>
                <td className={cn('text-right px-3 py-3 tabular-nums', tot.overUnder > 0 ? 'text-amber-700' : 'text-emerald-700')}>{fmtSigned(tot.overUnder)}</td>
                <td className="text-right px-5 py-3 tabular-nums">{fmt(tot.backlog)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ==================== AR AGING ====================

function ARReport() {
  const bucketTot = AR_BY_CLIENT.reduce(
    (a, r) => ({ current: a.current + r.current, d1_30: a.d1_30 + r.d1_30, d31_60: a.d31_60 + r.d31_60, d61_90: a.d61_90 + r.d61_90, d90p: a.d90p + r.d90p }),
    { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 }
  );
  const total = Object.values(bucketTot).reduce((a, b) => a + b, 0);
  const pastDue = total - bucketTot.current;
  const buckets = [
    { label: 'Current', value: bucketTot.current, tone: 'neutral' },
    { label: '1–30 days', value: bucketTot.d1_30, tone: 'neutral' },
    { label: '31–60 days', value: bucketTot.d31_60, tone: 'warn' },
    { label: '61–90 days', value: bucketTot.d61_90, tone: 'crit' },
    { label: '90+ days', value: bucketTot.d90p, tone: 'crit' },
  ];

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <KPI label="Total AR" value={fmt(total)} icon={Receipt} trendData={AR_TREND} trend={6.1} />
        <KPI label="Current" value={fmt(bucketTot.current)} sub={fmtPct(bucketTot.current / total) + ' of AR'} tone="ok" icon={CheckCircle2} />
        <KPI label="Past Due" value={fmt(pastDue)} sub={fmtPct(pastDue / total) + ' of AR'} tone="warn" icon={Clock} />
        <KPI label="60+ Days" value={fmt(bucketTot.d61_90 + bucketTot.d90p)} sub="Escalate" tone={bucketTot.d61_90 + bucketTot.d90p > 0 ? 'crit' : 'ok'} icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="col-span-2">
          <SectionHeading title="Aging distribution" subtitle="Dollar value outstanding in each age bucket. Tonal severity increases with age." />
          <ARHairlineBuckets buckets={buckets} />
        </Card>
        <Card>
          <SectionHeading title="AR trend" subtitle="Last 8 weeks." />
          <div className="h-28 w-full mt-2">
            <TrendArea data={AR_TREND} color="#4f46e5" />
          </div>
          <div className="flex items-end justify-between mt-3 pt-3 border-t border-slate-100">
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Latest</div>
              <div className="text-lg font-semibold text-slate-900 tabular-nums tracking-tight mt-0.5">{fmt(AR_TREND[AR_TREND.length - 1] * 1000)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-semibold">8wk change</div>
              <div className="text-sm font-semibold text-emerald-600 tabular-nums mt-0.5">+{fmtPct((AR_TREND[AR_TREND.length - 1] - AR_TREND[0]) / AR_TREND[0])}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card padding="p-0">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-semibold">By client</div>
          <div className="text-xs text-slate-500">{AR_BY_CLIENT.length} clients with outstanding AR</div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70 border-b border-slate-200">
            <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <th className="text-left px-5 py-3 font-semibold">Client</th>
              <th className="text-right px-3 py-3 font-semibold">Current</th>
              <th className="text-right px-3 py-3 font-semibold">1–30</th>
              <th className="text-right px-3 py-3 font-semibold">31–60</th>
              <th className="text-right px-3 py-3 font-semibold">61–90</th>
              <th className="text-right px-3 py-3 font-semibold">90+</th>
              <th className="text-right px-5 py-3 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {AR_BY_CLIENT.map((r) => {
              const rowTotal = r.current + r.d1_30 + r.d31_60 + r.d61_90 + r.d90p;
              return (
                <tr key={r.client} className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition last:border-0">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{r.client}</td>
                  <td className="text-right px-3 py-3.5 tabular-nums text-slate-600">{fmt(r.current)}</td>
                  <td className="text-right px-3 py-3.5 tabular-nums text-slate-600">{fmt(r.d1_30)}</td>
                  <td className={cn('text-right px-3 py-3.5 tabular-nums', r.d31_60 > 0 && 'text-amber-700 font-medium')}>{fmt(r.d31_60)}</td>
                  <td className={cn('text-right px-3 py-3.5 tabular-nums', r.d61_90 > 0 && 'text-red-700 font-medium')}>{fmt(r.d61_90)}</td>
                  <td className={cn('text-right px-3 py-3.5 tabular-nums', r.d90p > 0 && 'text-red-700 font-semibold')}>{fmt(r.d90p)}</td>
                  <td className="text-right px-5 py-3.5 tabular-nums font-semibold text-slate-900">{fmt(rowTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// Hairline horizontal bucket bars — replaces chunky vertical chart
function ARHairlineBuckets({ buckets }) {
  const max = Math.max(...buckets.map((b) => b.value)) || 1;
  const toneStroke = { neutral: '#475569', warn: '#d97706', crit: '#dc2626' };
  const toneFill = { neutral: '#e2e8f0', warn: '#fed7aa', crit: '#fecaca' };

  return (
    <div className="space-y-3 mt-2">
      {buckets.map((b) => {
        const pct = (b.value / max) * 100;
        return (
          <div key={b.label} className="flex items-center gap-4">
            <div className="w-24 text-xs text-slate-600 font-medium">{b.label}</div>
            <div className="flex-1 relative h-6 flex items-center">
              <div className="absolute inset-y-2 left-0 right-0 border-t border-slate-100" />
              <div
                className="relative h-3 rounded-[2px] transition-all"
                style={{
                  width: `${Math.max(pct, b.value > 0 ? 2 : 0)}%`,
                  backgroundColor: toneFill[b.tone],
                  borderLeft: `2px solid ${toneStroke[b.tone]}`,
                }}
              />
            </div>
            <div className="w-20 text-right text-sm tabular-nums font-semibold text-slate-900">{fmt(b.value)}</div>
          </div>
        );
      })}
    </div>
  );
}

function TrendArea({ data, color }) {
  const W = 200, H = 80;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const step = W / (data.length - 1);
  const pts = data.map((v, i) => [i * step, 6 + (H - 12) - ((v - min) / range) * (H - 12)]);
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `M 0,${H} L ${line.split(' ').join(' L ')} L ${W},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#trendfill)" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ==================== JOB COST ====================

function CostReport() {
  const rows = JOB_COST.map((p) => {
    const variance = p.projected - p.budget;
    const variancePct = variance / p.budget;
    const costUsed = p.actual / p.budget;
    return { ...p, variance, variancePct, costUsed };
  });
  const tot = rows.reduce((a, r) => ({ budget: a.budget + r.budget, committed: a.committed + r.committed, actual: a.actual + r.actual, projected: a.projected + r.projected }), { budget: 0, committed: 0, actual: 0, projected: 0 });
  const totVar = tot.projected - tot.budget;

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <KPI label="Total Budget" value={fmt(tot.budget)} icon={Calculator} />
        <KPI label="Committed" value={fmt(tot.committed)} sub={fmtPct(tot.committed / tot.budget) + ' of budget'} icon={FileText} />
        <KPI label="Actual Spent" value={fmt(tot.actual)} sub={fmtPct(tot.actual / tot.budget) + ' of budget'} icon={TrendingUp} />
        <KPI label="Projected Variance" value={fmtSigned(totVar)} tone={totVar > 0 ? 'crit' : 'ok'} sub={`${totVar >= 0 ? '+' : ''}${((totVar / tot.budget) * 100).toFixed(1)}% vs budget`} icon={totVar > 0 ? AlertTriangle : CheckCircle2} />
      </div>

      <Card className="mb-6">
        <SectionHeading title="Budget vs Projected" subtitle="Hairline tracks show Actual, Committed, Budget, and Projected positions per project. The track scales to whichever is larger, so nothing overflows." />
        <div className="space-y-6 mt-6">
          {rows.map((r) => (
            <CostTrack key={r.id} row={r} />
          ))}
        </div>
      </Card>

      <Card padding="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70 border-b border-slate-200">
            <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <th className="text-left px-5 py-3 font-semibold">Project</th>
              <th className="text-right px-3 py-3 font-semibold">Budget</th>
              <th className="text-right px-3 py-3 font-semibold">Committed</th>
              <th className="text-right px-3 py-3 font-semibold">Actual</th>
              <th className="text-right px-3 py-3 font-semibold">Projected</th>
              <th className="text-right px-3 py-3 font-semibold">Variance</th>
              <th className="text-left px-5 py-3 font-semibold w-48">Cost Used</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-900">{r.name}</td>
                <td className="text-right px-3 py-3.5 tabular-nums text-slate-900">{fmt(r.budget)}</td>
                <td className="text-right px-3 py-3.5 tabular-nums text-slate-600">{fmt(r.committed)}</td>
                <td className="text-right px-3 py-3.5 tabular-nums text-slate-900">{fmt(r.actual)}</td>
                <td className="text-right px-3 py-3.5 tabular-nums font-medium text-slate-900">{fmt(r.projected)}</td>
                <td className={cn('text-right px-3 py-3.5 tabular-nums font-semibold', r.variance > 0 ? 'text-red-700' : r.variance < 0 ? 'text-emerald-700' : 'text-slate-500')}>
                  {fmtSigned(r.variance)}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-[3px] bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', r.costUsed > 0.9 ? 'bg-red-500' : r.costUsed > 0.75 ? 'bg-amber-500' : 'bg-emerald-500')}
                        style={{ width: `${Math.min(100, r.costUsed * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-slate-600 w-10 text-right">{fmtPct(r.costUsed)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// Hairline track with marker pins — replaces stacked-block bars, scales with largest value so nothing overflows
function CostTrack({ row }) {
  const scale = Math.max(row.budget, row.projected) * 1.08;
  const pos = (v) => (v / scale) * 100;
  const budgetX = pos(row.budget);
  const committedX = pos(row.committed);
  const actualX = pos(row.actual);
  const projectedX = pos(row.projected);
  const overrun = row.projected > row.budget;

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-sm font-medium text-slate-900">{row.name}</div>
        <div className={cn('text-xs font-semibold tabular-nums', row.variance > 0 ? 'text-red-600' : row.variance < 0 ? 'text-emerald-600' : 'text-slate-500')}>
          {fmtSigned(row.variance)} <span className="text-slate-400 font-normal">({row.variance >= 0 ? '+' : ''}{(row.variancePct * 100).toFixed(1)}%)</span>
        </div>
      </div>

      {/* Track */}
      <div className="relative h-10">
        {/* Base track */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-slate-200" />
        {/* In-budget portion: 0 to Budget */}
        <div className="absolute top-1/2 -translate-y-1/2 h-[3px] bg-slate-300 rounded-full" style={{ left: 0, width: `${budgetX}%` }} />
        {/* Overrun portion: Budget to Projected (if any) */}
        {overrun && (
          <div className="absolute top-1/2 -translate-y-1/2 h-[3px] bg-red-400 rounded-full" style={{ left: `${budgetX}%`, width: `${projectedX - budgetX}%` }} />
        )}
        {/* Committed line underneath (subtle) */}
        <div className="absolute top-1/2 translate-y-1.5 h-[2px] bg-indigo-200 rounded-full" style={{ left: 0, width: `${committedX}%` }} />
        {/* Actual line underneath (primary) */}
        <div className="absolute top-1/2 translate-y-1.5 h-[2px] bg-indigo-600 rounded-full" style={{ left: 0, width: `${actualX}%` }} />

        {/* Markers */}
        <Marker x={actualX} label="Actual" value={fmt(row.actual)} color="#4f46e5" position="top" />
        <Marker x={committedX} label="Committed" value={fmt(row.committed)} color="#94a3b8" position="bottom" />
        <Marker x={budgetX} label="Budget" value={fmt(row.budget)} color="#0f172a" position="top" isLine />
        {overrun && <Marker x={projectedX} label="Projected" value={fmt(row.projected)} color="#dc2626" position="bottom" />}
        {!overrun && <Marker x={projectedX} label="Projected" value={fmt(row.projected)} color="#059669" position="bottom" />}
      </div>
    </div>
  );
}

function Marker({ x, label, value, color, position, isLine }) {
  return (
    <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${x}%` }}>
      {isLine ? (
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full ring-2 ring-white" style={{ backgroundColor: color }} />
      )}
      <div
        className="absolute -translate-x-1/2 whitespace-nowrap"
        style={{ left: 0, [position === 'top' ? 'bottom' : 'top']: '14px' }}
      >
        <div className="text-[9px] uppercase tracking-[0.06em] font-semibold" style={{ color }}>{label}</div>
        <div className="text-[11px] tabular-nums font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

// ==================== CASHFLOW PROJECTION ====================

function CashflowReport() {
  let balance = STARTING_BALANCE;
  const enriched = CASHFLOW.map((w) => {
    const net = w.in - w.out;
    balance += net;
    return { ...w, net, balance };
  });
  const totalIn = enriched.reduce((a, w) => a + w.in, 0);
  const totalOut = enriched.reduce((a, w) => a + w.out, 0);
  const endBalance = balance;
  const minBalance = Math.min(...enriched.map((w) => w.balance));
  const lowWeek = enriched.find((w) => w.balance === minBalance);

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <KPI label="Starting Balance" value={fmtK(STARTING_BALANCE)} icon={Wallet} />
        <KPI label="Projected Inflows" value={fmtK(totalIn)} sub="Next 12 weeks" tone="ok" icon={ArrowUpRight} />
        <KPI label="Projected Outflows" value={fmtK(totalOut)} sub="Next 12 weeks" tone="warn" icon={ArrowDownRight} />
        <KPI label="Projected End Balance" value={fmtK(endBalance)} sub={`Low point ${fmtK(minBalance)} at ${lowWeek?.week}`} tone={minBalance < 200 ? 'crit' : minBalance < 400 ? 'warn' : 'ok'} icon={TrendingUp} />
      </div>

      <Card className="mb-6">
        <SectionHeading title="Inflows, outflows & running balance" subtitle="Slim paired bars show gross weekly flow. The indigo line traces running cash position." />
        <CashflowChart data={enriched} />
      </Card>

      <Card padding="p-0">
        <div className="px-5 py-3 border-b border-slate-200 text-[10px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Weekly breakdown</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70 border-b border-slate-200">
            <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <th className="text-left px-5 py-3 font-semibold">Week</th>
              <th className="text-left px-3 py-3 font-semibold">Date</th>
              <th className="text-right px-3 py-3 font-semibold">Inflow</th>
              <th className="text-right px-3 py-3 font-semibold">Outflow</th>
              <th className="text-right px-3 py-3 font-semibold">Net</th>
              <th className="text-right px-5 py-3 font-semibold">Running Balance</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((w) => (
              <tr key={w.week} className="border-b border-slate-100 hover:bg-slate-50/60 last:border-0">
                <td className="px-5 py-2.5 font-medium text-slate-900">{w.week}</td>
                <td className="px-3 py-2.5 text-slate-600">{w.date}</td>
                <td className="text-right px-3 py-2.5 tabular-nums text-emerald-700">{fmtK(w.in)}</td>
                <td className="text-right px-3 py-2.5 tabular-nums text-red-700">-{fmtK(w.out)}</td>
                <td className={cn('text-right px-3 py-2.5 tabular-nums font-medium', w.net >= 0 ? 'text-emerald-700' : 'text-red-700')}>{w.net >= 0 ? '+' : ''}{fmtK(Math.abs(w.net))}</td>
                <td className={cn('text-right px-5 py-2.5 tabular-nums font-semibold', w.balance < 200 ? 'text-red-700' : w.balance < 400 ? 'text-amber-700' : 'text-slate-900')}>{fmtK(w.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function CashflowChart({ data }) {
  const W = 960, H = 280;
  const pad = { top: 32, right: 28, bottom: 52, left: 60 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const balances = data.map((d) => d.balance);
  const rawMax = Math.max(...balances);
  const rawMin = Math.min(0, ...balances);
  const maxBal = Math.ceil(rawMax / 200) * 200;
  const minBal = rawMin < 0 ? Math.floor(rawMin / 200) * 200 : 0;
  const balRange = maxBal - minBal || 1;

  const maxFlow = Math.max(...data.map((d) => Math.max(d.in, d.out)));
  const slotW = plotW / data.length;
  const barW = Math.min(6, slotW * 0.14);
  const zeroY = pad.top + plotH - ((0 - minBal) / balRange) * plotH;
  const flowScale = (plotH * 0.46) / maxFlow;

  const balPts = data.map((d, i) => {
    const x = pad.left + slotW * i + slotW / 2;
    const y = pad.top + plotH - ((d.balance - minBal) / balRange) * plotH;
    return [x, y];
  });
  const linePath = balPts.reduce((p, [x, y], i) => (i === 0 ? `M ${x},${y}` : `${p} L ${x},${y}`), '');
  const areaPath = `${linePath} L ${balPts[balPts.length - 1][0]},${pad.top + plotH} L ${balPts[0][0]},${pad.top + plotH} Z`;

  const yTicks = 5;
  const minIdx = balances.indexOf(Math.min(...balances));
  const minPt = balPts[minIdx];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="bal-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
        </linearGradient>
      </defs>

      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const t = i / yTicks;
        const y = pad.top + plotH - t * plotH;
        const val = Math.round(minBal + t * balRange);
        return (
          <g key={i}>
            <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke={val === 0 ? '#cbd5e1' : '#f1f5f9'} strokeDasharray={val === 0 ? '' : '2,3'} />
            <text x={pad.left - 12} y={y + 3} fontSize="9.5" fill="#94a3b8" textAnchor="end" fontWeight="600" letterSpacing="0.04em">${val}K</text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const cx = pad.left + slotW * i + slotW / 2;
        const inH = d.in * flowScale;
        const outH = d.out * flowScale;
        return (
          <g key={`bars-${d.week}`}>
            <rect x={cx - barW - 1.25} y={zeroY - inH} width={barW} height={inH} rx="0.5" fill="#059669" opacity="0.32" />
            <rect x={cx + 1.25} y={zeroY} width={barW} height={outH} rx="0.5" fill="#dc2626" opacity="0.28" />
          </g>
        );
      })}

      <path d={areaPath} fill="url(#bal-area)" />
      <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />

      {balPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="white" stroke="#4f46e5" strokeWidth="1.5" />
      ))}

      {minPt && (
        <g>
          <circle cx={minPt[0]} cy={minPt[1]} r="5" fill="none" stroke="#4f46e5" strokeWidth="1" opacity="0.4" />
          <line x1={minPt[0]} x2={minPt[0]} y1={minPt[1] + 8} y2={minPt[1] + 20} stroke="#94a3b8" strokeWidth="0.75" strokeDasharray="2,2" />
          <text x={minPt[0]} y={minPt[1] + 32} fontSize="9.5" fill="#475569" textAnchor="middle" fontWeight="600" letterSpacing="0.04em">
            LOW ${Math.round(data[minIdx].balance)}K
          </text>
        </g>
      )}

      {data.map((d, i) => {
        const x = pad.left + slotW * i + slotW / 2;
        return (
          <g key={`x-${d.week}`}>
            <text x={x} y={H - 24} fontSize="10" fill="#475569" textAnchor="middle" fontWeight="600" letterSpacing="0.02em">{d.week}</text>
            <text x={x} y={H - 10} fontSize="9" fill="#94a3b8" textAnchor="middle">{d.date}</text>
          </g>
        );
      })}

      <g transform={`translate(${pad.left}, 16)`}>
        <line x1="0" y1="0" x2="16" y2="0" stroke="#4f46e5" strokeWidth="1.75" />
        <circle cx="8" cy="0" r="2.5" fill="white" stroke="#4f46e5" strokeWidth="1.5" />
        <text x="24" y="3.5" fontSize="10" fill="#334155" fontWeight="600" letterSpacing="0.02em">RUNNING BALANCE</text>
        <rect x="170" y="-3" width="4" height="6" rx="0.5" fill="#059669" opacity="0.4" />
        <text x="180" y="3.5" fontSize="10" fill="#64748b" fontWeight="500">Inflow</text>
        <rect x="218" y="-3" width="4" height="6" rx="0.5" fill="#dc2626" opacity="0.4" />
        <text x="228" y="3.5" fontSize="10" fill="#64748b" fontWeight="500">Outflow</text>
      </g>
    </svg>
  );
}

// ==================== LABOR & PRODUCTIVITY ====================

function LaborReport() {
  const tot = LABOR_BY_PROJECT.reduce(
    (a, r) => ({ hoursActual: a.hoursActual + r.hoursActual, hoursBudget: a.hoursBudget + r.hoursBudget, costActual: a.costActual + r.costActual, costBudget: a.costBudget + r.costBudget }),
    { hoursActual: 0, hoursBudget: 0, costActual: 0, costBudget: 0 }
  );
  const avgRate = tot.costActual / tot.hoursActual;
  const hoursPct = tot.hoursActual / tot.hoursBudget;
  const costPct = tot.costActual / tot.costBudget;

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <KPI label="Hours Logged" value={tot.hoursActual.toLocaleString()} sub={`${Math.round(hoursPct * 100)}% of budget`} icon={Clock} tone={hoursPct > 1 ? 'warn' : 'neutral'} trendData={LABOR_TREND} trend={8.2} />
        <KPI label="Labor Cost" value={fmt(tot.costActual)} sub={`${Math.round(costPct * 100)}% of budget`} icon={Wallet} tone={costPct > 1 ? 'warn' : 'neutral'} />
        <KPI label="Avg Blended Rate" value={`$${Math.round(avgRate)}/hr`} sub="All trades combined" icon={Users} />
        <KPI label="Hours Variance" value={fmtSigned(tot.hoursActual - tot.hoursBudget).replace('$', '').replace('-$', '-')} sub="vs. budget" tone={tot.hoursActual > tot.hoursBudget ? 'warn' : 'ok'} icon={tot.hoursActual > tot.hoursBudget ? AlertTriangle : CheckCircle2} />
      </div>

      <Card className="mb-6">
        <SectionHeading title="Hours composition by trade" subtitle="Per-project stacked segments show how hours distribute across trades. Tonal palette keeps the chart reading as data, not decoration." />
        <LaborStackedBars data={LABOR_BY_PROJECT} />
      </Card>

      <Card padding="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70 border-b border-slate-200">
            <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <th className="text-left px-5 py-3 font-semibold">Project</th>
              <th className="text-right px-3 py-3 font-semibold">Hours Actual</th>
              <th className="text-right px-3 py-3 font-semibold">Hours Budget</th>
              <th className="text-right px-3 py-3 font-semibold">Cost Actual</th>
              <th className="text-right px-3 py-3 font-semibold">Cost Budget</th>
              <th className="text-right px-3 py-3 font-semibold">Rate</th>
              <th className="text-left px-5 py-3 font-semibold w-36">Burn</th>
            </tr>
          </thead>
          <tbody>
            {LABOR_BY_PROJECT.map((r) => {
              const burn = r.hoursActual / r.hoursBudget;
              const rate = r.costActual / r.hoursActual;
              return (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition last:border-0">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{r.name}</td>
                  <td className="text-right px-3 py-3.5 tabular-nums text-slate-900">{r.hoursActual.toLocaleString()}</td>
                  <td className="text-right px-3 py-3.5 tabular-nums text-slate-600">{r.hoursBudget.toLocaleString()}</td>
                  <td className="text-right px-3 py-3.5 tabular-nums text-slate-900">{fmt(r.costActual)}</td>
                  <td className="text-right px-3 py-3.5 tabular-nums text-slate-600">{fmt(r.costBudget)}</td>
                  <td className="text-right px-3 py-3.5 tabular-nums text-slate-600">${Math.round(rate)}/hr</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-[3px] bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', burn > 1 ? 'bg-red-500' : burn > 0.9 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, burn * 100)}%` }} />
                      </div>
                      <span className={cn('text-xs tabular-nums w-10 text-right font-medium', burn > 1 ? 'text-red-700' : 'text-slate-600')}>{Math.round(burn * 100)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function LaborStackedBars({ data }) {
  const trades = ['gc', 'electrical', 'plumbing', 'framing', 'hvac', 'other'];
  // Refined tonal palette — related hues, desaturated, readable
  const colors = { gc: '#4f46e5', electrical: '#d97706', plumbing: '#0891b2', framing: '#7c3aed', hvac: '#be185d', other: '#64748b' };
  const labels = { gc: 'GC Labor', electrical: 'Electrical', plumbing: 'Plumbing', framing: 'Framing', hvac: 'HVAC', other: 'Other' };
  const maxHours = Math.max(...data.map((d) => d.hoursActual));

  return (
    <div className="mt-4">
      <div className="space-y-4">
        {data.map((p) => {
          const pct = p.hoursActual / maxHours;
          return (
            <div key={p.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-sm font-medium text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-500 tabular-nums">{p.hoursActual.toLocaleString()} hrs · {fmt(p.costActual)}</div>
              </div>
              <div className="relative h-3 bg-slate-50 rounded-sm overflow-hidden ring-1 ring-slate-100" style={{ width: `${pct * 100}%`, minWidth: 80 }}>
                {(() => {
                  let cursor = 0;
                  return trades.map((t, i) => {
                    const segPct = (p.trades[t] / p.hoursActual) * 100;
                    const style = { left: `${cursor}%`, width: `${segPct}%` };
                    cursor += segPct;
                    return <div key={t} className="absolute inset-y-0" style={{ ...style, backgroundColor: colors[t], opacity: 0.75, borderRight: i < trades.length - 1 ? '1px solid white' : 'none' }} title={`${labels[t]}: ${p.trades[t]}h`} />;
                  });
                })()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-600">
        {trades.map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors[t], opacity: 0.75 }} />
            <span>{labels[t]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== SCHEDULE PERFORMANCE ====================

function ScheduleReport() {
  const avgSpi = SCHEDULE_PERF.reduce((a, p) => a + p.spi, 0) / SCHEDULE_PERF.length;
  const behind = SCHEDULE_PERF.filter((p) => p.spi < 0.95).length;
  const ahead = SCHEDULE_PERF.filter((p) => p.spi > 1.05).length;
  const onTrack = SCHEDULE_PERF.length - behind - ahead;

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <KPI label="Portfolio SPI" value={avgSpi.toFixed(2)} sub={avgSpi >= 0.95 ? 'On track overall' : 'Portfolio drift'} tone={avgSpi >= 0.95 ? 'ok' : 'warn'} icon={CalendarClock} />
        <KPI label="Projects Behind" value={String(behind)} sub="SPI < 0.95" tone={behind > 0 ? 'warn' : 'ok'} icon={AlertTriangle} />
        <KPI label="On Track" value={String(onTrack)} sub="SPI 0.95–1.05" tone="ok" icon={CheckCircle2} />
        <KPI label="Ahead" value={String(ahead)} sub="SPI > 1.05" tone="ok" icon={TrendingUp} />
      </div>

      <Card className="mb-6">
        <SectionHeading title="Per-project SPI" subtitle="Horizontal tracks from 0.70 (behind) to 1.30 (ahead). Tick at 1.00 marks on-schedule; the dot is the project's current SPI." />
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 mt-6">
          {SCHEDULE_PERF.map((p) => <SPITrack key={p.id} project={p} />)}
        </div>
      </Card>

      <Card>
        <SectionHeading title="Planned vs actual timeline" subtitle="Hairline for planned duration. Filled line for actual/forecast. Dashed red line marks today." />
        <GanttStrip data={SCHEDULE_PERF} />
      </Card>
    </div>
  );
}

// Refined SPI indicator — horizontal track with position marker. Replaces semi-circle gauge.
function SPITrack({ project }) {
  const SPI_MIN = 0.7, SPI_MAX = 1.3;
  const range = SPI_MAX - SPI_MIN;
  const spi = Math.min(Math.max(project.spi, SPI_MIN), SPI_MAX);
  const x = ((spi - SPI_MIN) / range) * 100;
  const onScheduleX = ((1 - SPI_MIN) / range) * 100;
  const color = spi < 0.95 ? '#dc2626' : spi > 1.05 ? '#4f46e5' : '#059669';
  const status = spi < 0.95 ? 'Behind' : spi > 1.05 ? 'Ahead' : 'On track';
  const milestonesPct = project.milestonesHit / project.milestonesTotal;

  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-900 truncate">{project.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] uppercase tracking-[0.08em] font-semibold" style={{ color }}>{status}</span>
            <span className="text-[11px] text-slate-500">· {project.milestonesHit}/{project.milestonesTotal} milestones</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-semibold tabular-nums tracking-tight leading-none" style={{ color }}>{project.spi.toFixed(2)}</div>
          <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400 font-semibold mt-1">SPI</div>
        </div>
      </div>

      {/* Track */}
      <div className="relative h-5 mt-1">
        {/* Baseline */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-slate-200" />
        {/* On-schedule reference tick */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-px h-3 bg-slate-400" style={{ left: `${onScheduleX}%` }} />
        {/* Position marker */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full ring-2 ring-white" style={{ left: `${x}%`, backgroundColor: color }} />
        {/* Milestone progress hairline below */}
        <div className="absolute left-0 right-0 bottom-0 h-px bg-slate-100">
          <div className="h-full bg-slate-400 transition-all" style={{ width: `${milestonesPct * 100}%` }} />
        </div>
      </div>
      <div className="flex justify-between mt-1.5 text-[9px] uppercase tracking-[0.06em] text-slate-400 font-semibold tabular-nums">
        <span>0.70</span>
        <span style={{ position: 'absolute', left: `${onScheduleX}%`, transform: 'translateX(-50%)' }} className="!relative text-slate-500">1.00</span>
        <span>1.30</span>
      </div>
    </div>
  );
}

function GanttStrip({ data }) {
  const rowH = 44, W = 960, labelW = 240, barArea = W - labelW - 24;
  const H = data.length * rowH + 36;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3">
      {[0, 25, 50, 75, 100].map((p) => (
        <g key={p}>
          <line x1={labelW + (p / 100) * barArea} x2={labelW + (p / 100) * barArea} y1="8" y2={H - 20} stroke="#f1f5f9" strokeDasharray="2,3" />
          <text x={labelW + (p / 100) * barArea} y={H - 6} fontSize="9.5" fill="#94a3b8" textAnchor="middle" fontWeight="600" letterSpacing="0.04em">{p}%</text>
        </g>
      ))}
      {data.map((p, i) => {
        const y = 16 + i * rowH;
        const plannedX = labelW + (p.plannedStart / 100) * barArea;
        const plannedW = ((p.plannedEnd - p.plannedStart) / 100) * barArea;
        const actualX = labelW + (p.actualStart / 100) * barArea;
        const actualW = ((p.actualEnd - p.actualStart) / 100) * barArea;
        const todayX = labelW + (p.today / 100) * barArea;
        const actualColor = p.spi < 0.95 ? '#dc2626' : p.spi > 1.05 ? '#4f46e5' : '#059669';
        return (
          <g key={p.id}>
            <text x="8" y={y + 10} fontSize="12" fill="#0f172a" fontWeight="500">{p.name}</text>
            <text x="8" y={y + 26} fontSize="10" fill="#64748b" fontWeight="500">SPI {p.spi.toFixed(2)}</text>
            {/* Planned bar — hairline */}
            <line x1={plannedX} y1={y + 6} x2={plannedX + plannedW} y2={y + 6} stroke="#cbd5e1" strokeWidth="1" />
            <line x1={plannedX} y1={y + 3} x2={plannedX} y2={y + 9} stroke="#cbd5e1" strokeWidth="1" />
            <line x1={plannedX + plannedW} y1={y + 3} x2={plannedX + plannedW} y2={y + 9} stroke="#cbd5e1" strokeWidth="1" />
            {/* Actual bar — thin filled */}
            <rect x={actualX} y={y + 16} width={actualW} height="4" rx="0.5" fill={actualColor} opacity="0.85" />
            {/* Today marker */}
            <line x1={todayX} y1={y - 2} x2={todayX} y2={y + 30} stroke="#dc2626" strokeWidth="1" strokeDasharray="2,2" />
            <circle cx={todayX} cy={y + 23} r="2.5" fill="#dc2626" />
          </g>
        );
      })}
      <g transform={`translate(${W - 340}, 4)`}>
        <line x1="0" y1="2" x2="14" y2="2" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="0" y1="0" x2="0" y2="4" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="14" y1="0" x2="14" y2="4" stroke="#cbd5e1" strokeWidth="1" />
        <text x="20" y="5" fontSize="9.5" fill="#64748b" fontWeight="500" letterSpacing="0.02em">Planned</text>
        <rect x="76" y="0" width="14" height="4" rx="0.5" fill="#059669" opacity="0.85" />
        <text x="94" y="5" fontSize="9.5" fill="#64748b" fontWeight="500" letterSpacing="0.02em">Actual</text>
        <line x1="146" y1="-2" x2="146" y2="7" stroke="#dc2626" strokeWidth="1" strokeDasharray="2,2" />
        <text x="152" y="5" fontSize="9.5" fill="#64748b" fontWeight="500" letterSpacing="0.02em">Today</text>
      </g>
    </svg>
  );
}

// ==================== COMPLIANCE ====================

function ComplianceReport() {
  const sevBadge = {
    critical: 'bg-red-50 text-red-700 ring-red-200',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200',
    ok: 'bg-slate-50 text-slate-600 ring-slate-200',
  };
  const cellTone = {
    ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    expiring: 'bg-amber-50 text-amber-700 ring-amber-200',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200',
    missing: 'bg-red-50 text-red-700 ring-red-200',
    'n/a': 'bg-slate-50 text-slate-400 ring-slate-200',
  };
  const cellLabel = { ok: '✓', expiring: '!', warning: '!', missing: '✕', 'n/a': '—' };

  const critCount = COMPLIANCE_EXPIRING.filter((e) => e.sev === 'critical').length;
  const warnCount = COMPLIANCE_EXPIRING.filter((e) => e.sev === 'warning').length;

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <KPI label="Critical" value={String(critCount)} sub="Expiring ≤14 days or missing" tone="crit" icon={AlertTriangle} />
        <KPI label="Warning" value={String(warnCount)} sub="Expiring 15–45 days" tone="warn" icon={Clock} />
        <KPI label="Subs Tracked" value={String(SUB_MATRIX.length)} sub="Active on current projects" icon={Users} />
      </div>

      <Card className="mb-6" padding="p-0">
        <div className="px-5 py-3 border-b border-slate-200 text-[10px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Expiring in the next 90 days</div>
        <div className="divide-y divide-slate-100">
          {COMPLIANCE_EXPIRING.map((e, i) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/60 cursor-pointer transition">
              <div className="flex items-center gap-3">
                <span className={cn('px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-[0.06em] ring-1', sevBadge[e.sev])}>
                  {e.sev}
                </span>
                <div>
                  <div className="text-sm font-medium text-slate-900">{e.sub}</div>
                  <div className="text-xs text-slate-500">{e.doc}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm tabular-nums text-slate-900">{e.expires}</div>
                <div className="text-xs text-slate-500">{e.days === null ? 'Document missing' : `in ${e.days} days`}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="p-0">
        <div className="px-5 py-3 border-b border-slate-200 text-[10px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Subcontractor compliance matrix</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70 border-b border-slate-200">
            <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <th className="text-left px-5 py-3 font-semibold">Subcontractor</th>
              <th className="text-left px-3 py-3 font-semibold">Trade</th>
              <th className="text-center px-2 py-3 font-semibold">GL</th>
              <th className="text-center px-2 py-3 font-semibold">WC</th>
              <th className="text-center px-2 py-3 font-semibold">Auto</th>
              <th className="text-center px-2 py-3 font-semibold">Bond</th>
              <th className="text-center px-2 py-3 font-semibold">W-9</th>
              <th className="text-center px-5 py-3 font-semibold">License</th>
            </tr>
          </thead>
          <tbody>
            {SUB_MATRIX.map((s) => (
              <tr key={s.name} className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition last:border-0">
                <td className="px-5 py-3 font-medium text-slate-900">{s.name}</td>
                <td className="px-3 py-3 text-slate-600">{s.trade}</td>
                {['gl', 'wc', 'auto', 'bond', 'w9', 'license'].map((k, idx) => (
                  <td key={k} className={cn('text-center py-3', idx === 5 ? 'px-5' : 'px-2')}>
                    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-semibold ring-1', cellTone[s[k]] || cellTone['n/a'])}>
                      {cellLabel[s[k]] || '—'}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ==================== SAVED REPORTS ====================

function SavedReportsView() {
  const [query, setQuery] = useState('');
  const filtered = SAVED_REPORTS.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()) || r.type.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <KPI label="Saved Reports" value={String(SAVED_REPORTS.length)} icon={Bookmark} />
        <KPI label="Scheduled" value={String(SAVED_REPORTS.filter((r) => r.schedule).length)} sub="Auto-email cadence set" icon={Mail} />
        <KPI label="Recipients Reached" value={String(new Set(SAVED_REPORTS.flatMap((r) => r.recipients)).size)} sub="Unique email addresses" icon={Users} />
      </div>

      <Card padding="p-0">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search saved reports..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="text-xs text-slate-500 ml-auto">{filtered.length} of {SAVED_REPORTS.length}</div>
          <button className="px-2.5 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center gap-1 transition">
            <Plus size={12} /> New
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70 border-b border-slate-200">
            <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <th className="text-left px-5 py-3 font-semibold">Name</th>
              <th className="text-left px-3 py-3 font-semibold">Type</th>
              <th className="text-left px-3 py-3 font-semibold">Scope</th>
              <th className="text-left px-3 py-3 font-semibold">Schedule</th>
              <th className="text-left px-3 py-3 font-semibold">Recipients</th>
              <th className="text-left px-3 py-3 font-semibold">Last Run</th>
              <th className="text-left px-3 py-3 font-semibold">Owner</th>
              <th className="text-right px-5 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition last:border-0">
                <td className="px-5 py-3.5">
                  <div className="font-medium text-slate-900 flex items-center gap-2">
                    <Bookmark size={13} className="text-indigo-500" fill="currentColor" />
                    {r.name}
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] bg-slate-100 text-slate-700 rounded">{r.type}</span>
                </td>
                <td className="px-3 py-3.5 text-slate-600 text-xs">{r.scope}</td>
                <td className="px-3 py-3.5 text-slate-600 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Mail size={11} className="text-slate-400" />
                    {r.schedule}
                  </div>
                </td>
                <td className="px-3 py-3.5 text-slate-600 text-xs">
                  {r.recipients.length === 1 ? r.recipients[0] : `${r.recipients[0]} +${r.recipients.length - 1}`}
                </td>
                <td className="px-3 py-3.5 text-slate-600 text-xs tabular-nums">{r.lastRun}</td>
                <td className="px-3 py-3.5 text-slate-600 text-xs">{r.owner}</td>
                <td className="px-5 py-3.5 text-right">
                  <button className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                    <MoreHorizontal size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
