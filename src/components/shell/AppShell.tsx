"use client";

import { useState, type ReactNode } from "react";

// ── Types ─────────────────────────────────────────────────────────
export type PortalType = "contractor" | "subcontractor" | "commercial" | "residential";

export type NavItem = {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: number;
  badgeType?: "default" | "warn" | "danger";
  active?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
};

export type ShellProject = {
  name: string;
  href?: string;
  phase?: string;
  dot: "green" | "amber" | "red" | "gray";
  active?: boolean;
};

export type Breadcrumb = { label: string; href?: string };

export type AppShellProps = {
  portalType: PortalType;
  orgName: string;
  memberCount?: number;
  userName: string;
  userRole: string;
  navSections: NavSection[];
  projects: ShellProject[];
  breadcrumbs: Breadcrumb[];
  children: ReactNode;
};

// Portal accent palette — exact hex from CLAUDE.md
const ACCENTS: Record<PortalType, { base: string; light: string; hover: string; tint: string; tintText: string }> = {
  contractor:    { base: "#5b4fc7", light: "#7c6fe0", hover: "#4f44b3", tint: "#eeedfb", tintText: "#4a3fb0" },
  subcontractor: { base: "#3d6b8e", light: "#5c8bae", hover: "#335a78", tint: "#e8eff6", tintText: "#335a78" },
  commercial:    { base: "#3178b9", light: "#5a94cc", hover: "#276299", tint: "#e8f1fa", tintText: "#276299" },
  residential:   { base: "#2a7f6f", light: "#4aa291", hover: "#226456", tint: "#e6f2ef", tintText: "#226456" },
};

// ── Inline SVG Icons (from prototype) ─────────────────────────────
const ChevronRight = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const SearchIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);
const BellIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
  </svg>
);
const MoonIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);
const SunIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);
const CollapseIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
const ExpandIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);
const LogoMark = (
  <svg viewBox="0 0 80 80">
    <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5" />
    <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75" />
    <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95" />
  </svg>
);

export default function AppShell({
  portalType,
  orgName,
  memberCount,
  userName,
  userRole,
  navSections,
  projects,
  breadcrumbs,
  children,
}: AppShellProps) {
  const [dark, setDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((s) => [s.label, s.defaultOpen ?? true]))
  );

  const accent = ACCENTS[portalType];
  const toggle = (label: string) => setExpanded((p) => ({ ...p, [label]: !p[label] }));
  const initials = userName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div
      className={`bcrm ${dark ? "dark" : ""} ${collapsed ? "collapsed" : ""}`}
      style={
        {
          ["--accent" as string]: accent.base,
          ["--accent-l" as string]: accent.light,
          ["--accent-h" as string]: accent.hover,
          ["--accent-s" as string]: accent.tint,
          ["--accent-t" as string]: accent.tintText,
        } as React.CSSProperties
      }
    >
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');

.bcrm{
  --s0:#f0f1f4;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;
  --sb-bg:#fafbfc;--sb-h:#eff0f4;--sb-a:#e8e9f0;
  --sb-bdr:#e4e6eb;--sb-mbg:#fff;--sb-mbdr:#e0e3e8;
  --t1:#111318;--t2:#4a4f5c;--t3:#7d8290;
  --ac:var(--accent);--ac-h:var(--accent-h);--ac-s:var(--accent-s);--ac-t:var(--accent-t);
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shlg:0 10px 32px rgba(26,23,20,.08);--shri:0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
  --sw:260px;--sw-c:68px;--th:56px;
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;--ds:350ms;
  --tb-bg:rgba(255,255,255,.88);--tl:#dde0e5;
  font-family:var(--fb);color:var(--t1);
  -webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);min-height:100vh;
}
.bcrm.dark{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;
  --sb-bg:#10121a;--sb-h:#1a1d2a;--sb-a:#222536;
  --sb-bdr:#222536;--sb-mbg:#151820;--sb-mbdr:#272b3a;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --tb-bg:rgba(16,18,26,.88);--tl:#2e3240;
}

.b-app{display:grid;grid-template-columns:var(--sw) 1fr;min-height:100vh;transition:grid-template-columns var(--ds) var(--e)}
.bcrm.collapsed .b-app{grid-template-columns:var(--sw-c) 1fr}

/* sidebar */
.b-sb{background:var(--sb-bg);border-right:1px solid var(--sb-bdr);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden;z-index:100}
.b-hdr{padding:0 14px;height:var(--th);display:flex;align-items:center;border-bottom:1px solid var(--sb-bdr);flex-shrink:0}
.b-hdr-row{display:flex;align-items:center;gap:8px;min-width:0;width:100%}
.b-logo{width:26px;height:26px;border-radius:6px;background:linear-gradient(135deg,#2c2541 0%,var(--ac) 100%);display:grid;place-items:center;flex-shrink:0;overflow:hidden}
.b-logo svg{width:26px;height:26px}
.b-appn{font-family:var(--fd);font-size:16px;font-weight:780;color:var(--t1);letter-spacing:-.02em;line-height:1;flex-shrink:0}
.b-collapse{width:22px;height:22px;border-radius:4px;border:1px solid var(--s3);background:var(--sb-mbg);color:var(--t3);display:grid;place-items:center;cursor:pointer;flex-shrink:0;margin-left:auto;transition:all var(--df) var(--e)}
.b-collapse:hover{border-color:var(--s4);color:var(--t2);background:var(--sb-h)}

/* org block */
.b-org{padding:10px 16px;border-bottom:1px solid var(--sb-bdr);flex-shrink:0}
.b-orgn{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);letter-spacing:-.01em;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.b-orgm{font-family:var(--fb);font-size:12px;font-weight:520;color:var(--t3);line-height:1.2;margin-top:2px}

/* nav */
.b-nav{flex:1;overflow-y:auto;overflow-x:hidden;padding:6px 10px 12px}
.b-nav::-webkit-scrollbar{width:3px}
.b-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}

.b-mod{background:var(--sb-mbg);border:1px solid var(--sb-mbdr);border-radius:var(--r-l);margin-bottom:6px;overflow:hidden;transition:border-color var(--dn) var(--e),box-shadow var(--dn) var(--e)}
.b-mod:hover{border-color:var(--s4)}
.b-mod.exp{box-shadow:var(--shsm)}
.b-mod-h{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;user-select:none;background:none;border:none;width:100%;font-family:var(--fd);font-size:12.5px;font-weight:720;color:var(--t1);letter-spacing:-.01em;transition:background var(--df) var(--e)}
.b-mod-h:hover{background:var(--sb-h)}
.b-mod-chev{width:12px;height:12px;margin-left:auto;flex-shrink:0;color:var(--t3);transition:transform var(--dn) var(--e)}
.b-mod-chev.open{transform:rotate(90deg)}

.b-tree{padding:0 6px 6px}
.b-ti{display:flex;align-items:center;gap:6px;padding:6px 8px 6px 14px;margin-left:10px;border-left:1.5px solid var(--tl);font-size:13px;font-weight:600;color:var(--t2);cursor:pointer;border-radius:0 var(--r-s) var(--r-s) 0;transition:all var(--df) var(--e);position:relative;text-decoration:none}
.b-ti::before{content:'';position:absolute;left:-1.5px;top:50%;width:10px;height:1.5px;background:var(--tl)}
.b-ti:last-child{border-left-color:transparent}
.b-ti:last-child::after{content:'';position:absolute;left:-1.5px;top:0;width:1.5px;height:50%;background:var(--tl)}
.b-ti:hover{background:var(--sb-h);color:var(--t1)}
.b-ti.on{background:var(--ac-s);color:var(--ac-t);font-weight:700}
.b-tbdg{min-width:16px;height:16px;padding:0 5px;border-radius:999px;font-size:10px;font-weight:750;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0;margin-left:auto;background:var(--ac-s);color:var(--ac-t)}
.b-tbdg.warn{background:var(--wr-s);color:var(--wr-t)}
.b-tbdg.danger{background:var(--dg-s);color:var(--dg-t)}

.b-tp{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 14px;margin-left:10px;border-left:1.5px solid var(--tl);font-size:13px;font-weight:580;color:var(--t2);cursor:pointer;border-radius:0 var(--r-s) var(--r-s) 0;transition:all var(--df) var(--e);position:relative;text-decoration:none}
.b-tp::before{content:'';position:absolute;left:-1.5px;top:50%;width:10px;height:1.5px;background:var(--tl)}
.b-tp:last-child{border-left-color:transparent}
.b-tp:last-child::after{content:'';position:absolute;left:-1.5px;top:0;width:1.5px;height:50%;background:var(--tl)}
.b-tp:hover{background:var(--sb-h);color:var(--t1)}
.b-tp.on{background:var(--ac-s);color:var(--ac-t);font-weight:680}
.b-pd{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.b-pd.green{background:var(--ok)}.b-pd.amber{background:var(--wr)}.b-pd.red{background:var(--dg)}.b-pd.gray{background:var(--s4)}
.b-pp{font-family:var(--fd);font-size:10.5px;font-weight:680;color:var(--t2);letter-spacing:.01em;margin-left:auto;flex-shrink:0}

/* footer */
.b-foot{border-top:1px solid var(--sb-bdr);padding:10px 14px;flex-shrink:0}
.b-user{display:flex;align-items:center;gap:10px;padding:6px;border-radius:var(--r-m);cursor:pointer;transition:background var(--df) var(--e)}
.b-user:hover{background:var(--sb-h)}
.b-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--ac) 0%,var(--accent-l) 100%);color:#fff;display:grid;place-items:center;font-family:var(--fd);font-size:11px;font-weight:800;flex-shrink:0}
.b-un{font-size:13px;font-weight:660;color:var(--t1);line-height:1.2}
.b-ur{font-size:11px;font-weight:520;color:var(--t3);line-height:1.2;margin-top:1px}

/* collapsed mode hides labels */
.bcrm.collapsed .b-appn,
.bcrm.collapsed .b-org,
.bcrm.collapsed .b-mod-h,
.bcrm.collapsed .b-tree,
.bcrm.collapsed .b-un,
.bcrm.collapsed .b-ur{display:none}
.bcrm.collapsed .b-hdr-row{justify-content:center}
.bcrm.collapsed .b-collapse{margin-left:0}
.bcrm.collapsed .b-foot{display:flex;justify-content:center}

/* main */
.b-main{min-width:0;display:flex;flex-direction:column}
.b-top{height:var(--th);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:var(--tb-bg);backdrop-filter:blur(12px);position:sticky;top:0;z-index:50}
.b-bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:580;color:var(--t3)}
.b-bc-lnk{cursor:pointer;transition:color var(--df);text-decoration:none;color:inherit}
.b-bc-lnk:hover{color:var(--t2)}
.b-bc-sep{font-size:10px;color:var(--s4)}
.b-bc-cur{color:var(--t1);font-weight:720}
.b-tr{display:flex;align-items:center;gap:6px}
.b-tbb{width:32px;height:32px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df) var(--e);position:relative}
.b-tbb:hover{border-color:var(--s4);color:var(--t2);background:var(--sh)}
.b-nd{position:absolute;top:5px;right:5px;width:7px;height:7px;border-radius:50%;background:var(--dg);border:2px solid var(--s1)}
.b-tav{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--ac) 0%,var(--accent-l) 100%);color:#fff;display:grid;place-items:center;font-family:var(--fd);font-size:10.5px;font-weight:800;cursor:pointer;margin-left:2px}

/* content */
.b-cnt{padding:24px;flex:1;overflow-x:hidden}
      `}</style>

      <div className="b-app">
        <aside className="b-sb">
          <div className="b-hdr">
            <div className="b-hdr-row">
              <div className="b-logo">{LogoMark}</div>
              <span className="b-appn">BuiltCRM</span>
              <button className="b-collapse" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar">
                {collapsed ? ExpandIcon : CollapseIcon}
              </button>
            </div>
          </div>

          <div className="b-org">
            <div className="b-orgn">{orgName}</div>
            {memberCount != null && (
              <div className="b-orgm">
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </div>
            )}
          </div>

          <nav className="b-nav">
            {navSections.map((section) => {
              const isOpen = !!expanded[section.label];
              return (
                <div className={`b-mod ${isOpen ? "exp" : ""}`} key={section.label}>
                  <button className="b-mod-h" onClick={() => toggle(section.label)}>
                    {section.label}
                    <span className={`b-mod-chev ${isOpen ? "open" : ""}`}>{ChevronRight}</span>
                  </button>
                  {isOpen && (
                    <div className="b-tree">
                      {section.items.map((item) => (
                        <a key={item.label} href={item.href} className={`b-ti ${item.active ? "on" : ""}`}>
                          {item.icon && <span style={{ display: "flex", color: "var(--t3)" }}>{item.icon}</span>}
                          <span style={{ flex: 1 }}>{item.label}</span>
                          {item.badge != null && (
                            <span className={`b-tbdg ${item.badgeType && item.badgeType !== "default" ? item.badgeType : ""}`}>
                              {item.badge}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {projects.length > 0 && (
              <div className="b-mod exp" style={{ marginTop: 4 }}>
                <div className="b-mod-h" style={{ cursor: "default" }}>Projects</div>
                <div className="b-tree">
                  {projects.map((p) => {
                    const inner = (
                      <>
                        <span className={`b-pd ${p.dot}`} />
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.name}
                        </span>
                        {p.phase && <span className="b-pp">{p.phase}</span>}
                      </>
                    );
                    return p.href ? (
                      <a key={p.name} href={p.href} className={`b-tp ${p.active ? "on" : ""}`}>{inner}</a>
                    ) : (
                      <div key={p.name} className={`b-tp ${p.active ? "on" : ""}`}>{inner}</div>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          <div className="b-foot">
            <div className="b-user">
              <div className="b-av">{initials}</div>
              <div>
                <div className="b-un">{userName}</div>
                <div className="b-ur">{userRole}</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="b-main">
          <div className="b-top">
            <div className="b-bc">
              {breadcrumbs.map((bc, i) => {
                const isLast = i === breadcrumbs.length - 1;
                return (
                  <span key={`${bc.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {i > 0 && <span className="b-bc-sep">/</span>}
                    {isLast || !bc.href ? (
                      <span className={isLast ? "b-bc-cur" : undefined}>{bc.label}</span>
                    ) : (
                      <a href={bc.href} className="b-bc-lnk">{bc.label}</a>
                    )}
                  </span>
                );
              })}
            </div>
            <div className="b-tr">
              <button className="b-tbb" onClick={() => setDark((d) => !d)} title={dark ? "Light mode" : "Dark mode"}>
                {dark ? SunIcon : MoonIcon}
              </button>
              <button className="b-tbb" aria-label="Notifications">
                {BellIcon}
                <div className="b-nd" />
              </button>
              <div className="b-tav">{initials}</div>
            </div>
          </div>

          <div className="b-cnt">{children}</div>
        </main>
      </div>
    </div>
  );
}
