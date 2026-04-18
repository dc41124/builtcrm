"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/auth/client";
import "./app-shell.css";

import { CommandPalette, type CommandPaletteHandle } from "./CommandPalette";
import { NotificationBell } from "./NotificationBell";
import { PORTAL_ACCENTS, type PortalType } from "@/lib/portal-colors";

// Re-export so existing consumers that import PortalType from AppShell still work.
export type { PortalType } from "@/lib/portal-colors";

// ── Types ─────────────────────────────────────────────────────────

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
  placement?: "before-projects" | "after-projects";
};

export type ShellProject = {
  /** Project UUID — set by loadPortalShell. Optional for legacy callers. */
  id?: string;
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
  userName: string;
  userRole: string;
  navSections: NavSection[];
  projects: ShellProject[];
  /** Optional override. When omitted, breadcrumbs derive from the pathname. */
  breadcrumbs?: Breadcrumb[];
  children: ReactNode;
};

// Known route slug → breadcrumb label. Anything not listed falls back to
// title-casing the slug.
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  approvals: "Approvals",
  messages: "Messages",
  rfis: "RFIs",
  "change-orders": "Change Orders",
  billing: "Billing & Draws",
  compliance: "Compliance",
  "upload-requests": "Upload Requests",
  documents: "Documents",
  budget: "Budget",
  "payment-tracking": "Payment Tracking",
  retainage: "Retainage",
  schedule: "Schedule",
  selections: "Selections",
  payments: "Payments",
  today: "Today Board",
  organization: "Organization",
  team: "Team & Roles",
  integrations: "Integrations",
  progress: "Progress & Updates",
  photos: "Photos",
  contracts: "Contracts",
  "scope-changes": "Scope Changes",
  "confirmed-choices": "Confirmed Choices",
  settings: "Settings",
};

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((p) => p[0]?.toUpperCase() + p.slice(1))
    .join(" ");
}

function portalRoot(portalType: PortalType, projects: ShellProject[]): { label: string; href: string } {
  switch (portalType) {
    case "contractor":
      return { label: "Contractor", href: "/contractor/dashboard" };
    case "subcontractor":
      return { label: "Subcontractor", href: "/subcontractor/today" };
    case "commercial":
      return { label: "Commercial", href: projects[0]?.href ?? "/commercial" };
    case "residential":
      return { label: "My project", href: projects[0]?.href ?? "/residential" };
  }
}

function deriveBreadcrumbs(
  pathname: string | null,
  portalType: PortalType,
  projects: ShellProject[],
): Breadcrumb[] {
  const root = portalRoot(portalType, projects);
  if (!pathname) return [root];
  const segs = pathname.split("/").filter(Boolean);
  const crumbs: Breadcrumb[] = [root];
  // segs[0] is the portal (contractor / subcontractor / commercial / residential)
  if (segs.length < 2) return crumbs;

  // Project-scoped: /{portal}/project/{id}[/{subsection}]
  if (segs[1] === "project" && segs[2]) {
    const projectHref = `/${segs[0]}/project/${segs[2]}`;
    const project = projects.find((p) => p.href === projectHref);
    crumbs.push({
      label: project?.name ?? "Project",
      href: segs.length > 3 ? projectHref : undefined,
    });
    if (segs.length === 3) {
      crumbs.push({ label: "Project Home" });
    } else if (segs[3]) {
      crumbs.push({ label: SEGMENT_LABELS[segs[3]] ?? titleCase(segs[3]) });
    }
    return crumbs;
  }

  // Non-project page: /{portal}/{slug}[/{sub}]
  const last = segs[segs.length - 1];
  crumbs.push({ label: SEGMENT_LABELS[last] ?? titleCase(last) });
  return crumbs;
}

// Portal accent palette — sourced from shared module
const ACCENTS = PORTAL_ACCENTS;

// ── Inline SVG Icons (from prototype) ─────────────────────────────
const ChevronRight = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const ChevronDown = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const SearchIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
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
const MenuIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const CloseIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const FolderIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
  </svg>
);
const FolderOpenIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2l1-5a2 2 0 00-2-2H7a2 2 0 00-2 2l-1 5z" />
  </svg>
);
const LogoutIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const LogoMark = (
  <svg viewBox="0 0 80 80">
    <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5" />
    <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75" />
    <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95" />
  </svg>
);

const PROJECTS_KEY = "__projects__";

// Derives the "{segmentsAfterProjectId}" tail from a pathname for a
// /{portal}/project/{id}/...path URL. Returns null when the current page
// isn't project-scoped — the caller uses that signal to land on the new
// project's home instead of carrying the subsection forward.
function projectSubsection(
  pathname: string | null,
  portalType: PortalType,
): string | null {
  if (!pathname) return null;
  const segs = pathname.split("/").filter(Boolean);
  if (segs[0] !== portalType) return null;
  if (segs[1] !== "project" || !segs[2]) return null;
  return segs.slice(3).join("/");
}

function currentProjectId(
  pathname: string | null,
  portalType: PortalType,
): string | null {
  if (!pathname) return null;
  const segs = pathname.split("/").filter(Boolean);
  if (segs[0] !== portalType) return null;
  if (segs[1] !== "project" || !segs[2]) return null;
  return segs[2];
}

function ProjectSwitcher({
  portalType,
  projects,
}: {
  portalType: PortalType;
  projects: ShellProject[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIdx, setFocusedIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const activeProjectId = currentProjectId(pathname, portalType);
  const currentProject = useMemo(
    () =>
      projects.find((p) => p.id === activeProjectId) ??
      projects.find((p) => p.active) ??
      null,
    [projects, activeProjectId],
  );
  const subsection = projectSubsection(pathname, portalType);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  // Reset focus + query when the dropdown opens, then focus the search
  // input so users can start typing immediately. No-op on close.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setFocusedIdx(0);
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Clamp focused index whenever the filtered list shrinks (e.g. typing).
  useEffect(() => {
    if (focusedIdx > Math.max(0, filtered.length - 1)) setFocusedIdx(0);
  }, [filtered.length, focusedIdx]);

  // Keep the keyboard-focused row visible as the user arrows through a
  // long list. Skipped when the dropdown is closed or empty.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${focusedIdx}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [open, focusedIdx]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function go(project: ShellProject) {
    if (!project.href) return;
    // Carry the current subsection across when we're on a project page;
    // land on project home otherwise (cross-project pages like
    // /dashboard, /settings, /retainage have no meaningful subsection).
    const dest =
      activeProjectId && subsection
        ? `${project.href}/${subsection}`
        : project.href;
    setOpen(false);
    router.push(dest);
  }

  function onListKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = filtered[focusedIdx];
      if (p) go(p);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusedIdx(Math.max(0, filtered.length - 1));
    }
  }

  if (projects.length === 0) return null;

  const buttonLabel = currentProject?.name ?? "Select project";

  return (
    <div className="b-psw" ref={rootRef}>
      <button
        type="button"
        className="b-psw-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch project"
      >
        <span className="b-psw-label">{buttonLabel}</span>
        <span className="b-psw-chev" aria-hidden>
          {ChevronDown}
        </span>
      </button>
      {open && (
        <div
          className="b-psw-panel"
          role="dialog"
          aria-label="Project switcher"
          onKeyDown={onListKeyDown}
        >
          <div className="b-psw-srch">
            <span className="b-psw-srch-ico" aria-hidden>
              {SearchIcon}
            </span>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              aria-label="Search projects"
            />
          </div>
          <div className="b-psw-list" role="listbox" ref={listRef}>
            {filtered.length === 0 ? (
              <div className="b-psw-empty">No projects match.</div>
            ) : (
              filtered.map((p, i) => {
                const isActive = p.id === activeProjectId;
                const isFocused = i === focusedIdx;
                return (
                  <button
                    key={p.id ?? p.href ?? p.name}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-idx={i}
                    className={`b-psw-row${isActive ? " on" : ""}${isFocused ? " kbd" : ""}`}
                    onMouseEnter={() => setFocusedIdx(i)}
                    onClick={() => go(p)}
                  >
                    <span className={`b-pd ${p.dot}`} />
                    <span className="b-psw-row-name">{p.name}</span>
                    {p.phase && <span className="b-psw-row-phase">{p.phase}</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppShell({
  portalType,
  orgName,
  userName,
  userRole,
  navSections,
  projects,
  breadcrumbs,
  children,
}: AppShellProps) {
  // Theme toggle is imperative (no React state) to avoid SSR/client hydration
  // mismatch — the pre-hydration script in app/layout.tsx may have already
  // applied `.dark` to <html> before React boots. Icons are rendered via CSS
  // (`html.dark` selectors in app-shell.css), not React conditionals.
  //
  // Toggling light <-> dark here also persists to the user's `users.theme`
  // preference so the topbar toggle and the Settings > Appearance radio stay
  // in sync. If the user had `theme = 'system'`, toggling demotes them to
  // an explicit `light` or `dark` (matches the spec's two-control model).
  const router = useRouter();
  const toggleTheme = () => {
    const root = document.documentElement;
    const isDark = root.classList.toggle("dark");
    const next: "light" | "dark" = isDark ? "dark" : "light";
    try {
      localStorage.setItem("builtcrm-theme", next);
      root.setAttribute("data-theme-pref", next);
    } catch {}
    // Persist then refresh the current route so any server-rendered shell
    // (e.g. the Settings > Appearance radio) re-reads the DB and stays in
    // sync with this imperative change. If the POST fails, localStorage
    // still holds the new choice so the next reload is still correct.
    void fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).then((res) => {
      if (res.ok) router.refresh();
    });
  };
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => ({
    ...Object.fromEntries(navSections.map((s) => [s.label, s.defaultOpen ?? true])),
    [PROJECTS_KEY]: true,
  }));

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = mobileOpen ? "hidden" : prev;
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Close drawer when resizing up from mobile
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const accent = ACCENTS[portalType];
  const toggle = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));
  const paletteRef = useRef<CommandPaletteHandle | null>(null);
  const openPalette = () => paletteRef.current?.open();
  const initials = userName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const projectsOpen = !!expanded[PROJECTS_KEY];
  const pathname = usePathname();
  const resolvedCrumbs =
    breadcrumbs && breadcrumbs.length > 0
      ? breadcrumbs
      : deriveBreadcrumbs(pathname, portalType, projects);

  const renderSections = (placement: "before-projects" | "after-projects") =>
    navSections
      .filter((s) => (s.placement ?? "before-projects") === placement)
      .map((section) => {
        const isOpen = !!expanded[section.label];
        return (
          <div className={`b-mod ${isOpen ? "exp" : ""}`} key={section.label}>
            <button className="b-mod-h" onClick={() => toggle(section.label)}>
              <span className="b-mod-ico">{isOpen ? FolderOpenIcon : FolderIcon}</span>
              {section.label}
              <span className={`b-mod-chev ${isOpen ? "open" : ""}`}>{ChevronRight}</span>
            </button>
            {isOpen && (
              <div className="b-tree">
                {section.items.map((item, i) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`b-ti ${item.active ? "on" : ""}`}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    {item.icon && (
                      <span style={{ display: "flex", color: "var(--t3)" }}>
                        {item.icon}
                      </span>
                    )}
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge != null && (
                      <span
                        className={`b-tbdg ${item.badgeType && item.badgeType !== "default" ? item.badgeType : ""}`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.active && <span className="b-dot-ac" />}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      });

  return (
    <div
      className={`bcrm ${mobileOpen ? "mobile-open" : ""}`}
      style={
        {
          ["--accent" as string]: accent.ac,
          ["--accent-l" as string]: accent.acl,
          ["--accent-h" as string]: accent.ach,
          ["--accent-s" as string]: accent.acs,
          ["--accent-t" as string]: accent.act,
        } as React.CSSProperties
      }
    >
      <div className="b-app">
        <div
          className="b-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
        <aside className="b-sb" onClick={(e) => {
          // close drawer when a nav link inside is tapped
          const target = e.target as HTMLElement;
          if (target.closest("a")) setMobileOpen(false);
        }}>
          <div className="b-hdr">
            <div className="b-hdr-row">
              <div className="b-logo">{LogoMark}</div>
              <span className="b-appn">BuiltCRM</span>
              <span className="b-slash">/</span>
              <span className="b-orgn">{orgName}</span>
              <button className="b-sw" aria-label="Switch workspace">
                {ChevronDown}
              </button>
            </div>
          </div>

          <nav className="b-nav">
            {renderSections("before-projects")}

            {projects.length > 0 && (
              <div className={`b-mod ${projectsOpen ? "exp" : ""}`}>
                <button className="b-mod-h" onClick={() => toggle(PROJECTS_KEY)}>
                  <span className="b-mod-ico">{projectsOpen ? FolderOpenIcon : FolderIcon}</span>
                  Projects
                  <span className={`b-mod-chev ${projectsOpen ? "open" : ""}`}>{ChevronRight}</span>
                </button>
                {projectsOpen && (
                  <div className="b-tree">
                    {projects.map((p, i) => {
                      const style = { animationDelay: `${i * 30}ms` };
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
                        <Link key={p.name} href={p.href} className={`b-tp ${p.active ? "on" : ""}`} style={style}>{inner}</Link>
                      ) : (
                        <div key={p.name} className={`b-tp ${p.active ? "on" : ""}`} style={style}>{inner}</div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {renderSections("after-projects")}
          </nav>

          <div className="b-foot">
            <div className="b-user">
              <div className="b-av">{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="b-un">{userName}</div>
                <div className="b-ur">{userRole}</div>
              </div>
              <button
                className="b-signout"
                onClick={async () => {
                  await signOut();
                  window.location.href = "/login";
                }}
                aria-label="Sign out"
                title="Sign out"
              >
                {LogoutIcon}
              </button>
            </div>
          </div>
        </aside>

        <main className="b-main">
          <div className="b-top">
            <button
              className="b-hamburger"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? CloseIcon : MenuIcon}
            </button>
            <div className="b-bc">
              {resolvedCrumbs.map((bc, i) => {
                const isLast = i === resolvedCrumbs.length - 1;
                return (
                  <span key={`${bc.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {i > 0 && <span className="b-bc-sep">›</span>}
                    {isLast || !bc.href ? (
                      <span className={isLast ? "b-bc-cur" : undefined}>{bc.label}</span>
                    ) : (
                      <Link href={bc.href!} className="b-bc-lnk">{bc.label}</Link>
                    )}
                  </span>
                );
              })}
            </div>
            <ProjectSwitcher portalType={portalType} projects={projects} />
            <button
              type="button"
              className="b-cmd-trig"
              onClick={openPalette}
              aria-label="Search (⌘K)"
              title="Search (⌘K)"
            >
              <span className="b-cmd-trig-left">
                <span className="b-cmd-trig-ico" aria-hidden>{SearchIcon}</span>
                <span className="b-cmd-trig-ph">Search…</span>
              </span>
              <kbd className="b-cmd-kbd">⌘K</kbd>
            </button>
            <div className="b-tr">
              <button
                type="button"
                className="b-tbb"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                <span className="b-theme-icon b-theme-sun" aria-hidden>{SunIcon}</span>
                <span className="b-theme-icon b-theme-moon" aria-hidden>{MoonIcon}</span>
              </button>
              <NotificationBell portalType={portalType} />
              <div className="b-tav">{initials}</div>
            </div>
          </div>

          <div className="b-cnt">{children}</div>
        </main>
      </div>
      <CommandPalette ref={paletteRef} portalType={portalType} />
    </div>
  );
}
