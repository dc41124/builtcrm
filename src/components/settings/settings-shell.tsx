"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/auth/client";
import {
  NOTIFICATION_GROUPS,
  type NotificationPrefState,
  type SettingsPortalType,
} from "@/lib/notification-catalog";
import type {
  ActiveSession,
  UserProfile,
  UserSettingsView,
} from "@/domain/loaders/user-settings";
import type { OrganizationMember } from "@/domain/loaders/organization-members";
import type { AuditEventView } from "@/domain/loaders/audit-log";
import { AUDIT_CATEGORIES } from "@/lib/audit-categories";
import type { ContractorIntegrationsView } from "@/domain/loaders/integrations";
import type { ContractorPaymentsView } from "@/domain/loaders/payments";
import type { SubComplianceRow } from "@/domain/loaders/subcontractor-compliance";
import type {
  OrganizationCertification,
  OrganizationLicense,
  OrganizationProfile,
} from "@/domain/loaders/organization-profile";
import { IntegrationsView } from "@/app/(portal)/contractor/(global)/settings/integrations/integrations-ui";
import { PaymentsView } from "@/app/(portal)/contractor/(global)/settings/payments/payments-ui";

export type ContractorSettingsBundle = {
  orgId: string;
  orgName: string;
  role: "contractor_admin" | "contractor_pm";
  currentUserId: string;
  members: OrganizationMember[];
  invitations: Array<{
    id: string;
    invitedEmail: string;
    invitedName: string | null;
    portalType: string;
    roleKey: string;
    status: string;
    expiresAt: Date;
    createdAt: Date;
    projectId: string | null;
    projectName: string | null;
    token: string;
  }>;
  auditEvents: AuditEventView[];
  integrations: ContractorIntegrationsView;
  payments: ContractorPaymentsView;
  orgProfile: OrganizationProfile | null;
  orgLicenses: OrganizationLicense[];
  nowMs: number;
};

export type SubcontractorSettingsBundle = {
  orgId: string;
  orgName: string;
  role: "subcontractor_owner" | "subcontractor_user";
  currentUserId: string;
  compliance: SubComplianceRow[];
  orgProfile?: OrganizationProfile | null;
  orgLicenses?: OrganizationLicense[];
  orgCertifications?: OrganizationCertification[];
};

// ── Icons (inline SVGs — prototype spec) ────────────────────────────────
const I = {
  sun: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  moon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ),
  user: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  shield: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  bellOutline: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  sparkle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.8L20 10.7l-5.1 3.7L16.8 20 12 16.5 7.2 20l1.9-5.6L4 10.7l6.1-1.9z" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  eye: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  laptop: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M2 20h20" />
    </svg>
  ),
  phone: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <line x1="12" y1="18" x2="12" y2="18" />
    </svg>
  ),
  upload: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  copy: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  link: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  card: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  file: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  arrowUp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  ),
  arrowDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  ),
  building: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  database: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  lock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  download: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  search: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  x: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  warn: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

// ── Tab descriptor ──────────────────────────────────────────────────────
type TabId =
  | "profile"
  | "security"
  | "notifications"
  | "appearance"
  | "organization"
  | "team"
  | "billing"
  | "data"
  | "orgsec"
  | "integrations"
  | "payments"
  | "compliance";
type TabDescriptor = { id: TabId; label: string; desc: string; icon: ReactNode };
const BASE_TABS: TabDescriptor[] = [
  { id: "profile", label: "Profile", icon: I.user, desc: "Name, contact info, and how you appear to others" },
  { id: "security", label: "Security", icon: I.shield, desc: "Password, two-factor authentication, and active sessions" },
  { id: "notifications", label: "Notifications", icon: I.bellOutline, desc: "What you hear about and how you hear about it" },
  { id: "appearance", label: "Appearance", icon: I.sparkle, desc: "Theme, language, and display preferences" },
];
const CONTRACTOR_TABS: TabDescriptor[] = [
  { id: "organization", label: "Organization", icon: I.building, desc: "Company profile, logo, and licensing" },
  { id: "team", label: "Team & roles", icon: I.users, desc: "Members, permissions, and invites" },
  { id: "billing", label: "Plan & billing", icon: I.card, desc: "Subscription, payment method, and invoices" },
  { id: "data", label: "Data", icon: I.database, desc: "Import, export, and migration" },
  { id: "orgsec", label: "Org security", icon: I.lock, desc: "SSO, domain rules, and the audit log" },
  { id: "integrations", label: "Integrations", icon: I.link, desc: "Accounting, calendar, and productivity tools" },
  { id: "payments", label: "Payments", icon: I.card, desc: "Stripe Connect, payouts, and payment history" },
];
const SUBCONTRACTOR_TABS: TabDescriptor[] = [
  { id: "organization", label: "Organization", icon: I.building, desc: "Company profile, trade, and licensing" },
  { id: "compliance", label: "Trade & compliance", icon: I.shield, desc: "Insurance, W-9, bonding, and certifications" },
];

// Friendly role label per portal (matches the sidebar footer role).
function roleLabelFor(portalType: SettingsPortalType): string {
  switch (portalType) {
    case "contractor":
      return "Contractor";
    case "subcontractor":
      return "Subcontractor";
    case "commercial":
      return "Client";
    case "residential":
      return "Homeowner";
  }
}

// ── Root ────────────────────────────────────────────────────────────────
export function SettingsShell({
  view,
  showDangerZone = false,
  contractor,
  subcontractor,
}: {
  view: UserSettingsView;
  showDangerZone?: boolean;
  contractor?: ContractorSettingsBundle;
  subcontractor?: SubcontractorSettingsBundle;
}) {
  const [tab, setTab] = useState<TabId>("profile");
  const tabs: TabDescriptor[] =
    view.portalType === "contractor"
      ? [...BASE_TABS, ...CONTRACTOR_TABS]
      : view.portalType === "subcontractor"
        ? [...BASE_TABS, ...SUBCONTRACTOR_TABS]
        : BASE_TABS;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "248px 1fr",
        gap: 28,
        alignItems: "start",
      }}
      className="settings-layout"
    >
      <style>{`
        @media (max-width: 960px) {
          .settings-layout { grid-template-columns: 1fr !important; }
          .settings-subnav { position: static !important; }
        }
      `}</style>
      <SettingsSubNav tabs={tabs} tab={tab} setTab={setTab} />
      <div key={tab} style={{ animation: "fadeIn .24s cubic-bezier(.16,1,.3,1)" }}>
        {tab === "profile" && <ProfileTab view={view} />}
        {tab === "security" && <SecurityTab view={view} />}
        {tab === "notifications" && <NotificationsTab view={view} />}
        {tab === "appearance" && (
          <AppearanceTab view={view} showDangerZone={showDangerZone} />
        )}
        {tab === "organization" && view.portalType === "contractor" && (
          <ContractorOrganizationTab contractor={contractor} />
        )}
        {tab === "organization" && view.portalType === "subcontractor" && (
          <SubcontractorOrganizationTab subcontractor={subcontractor} />
        )}
        {tab === "team" && <ContractorTeamRolesTab contractor={contractor} />}
        {tab === "billing" && <ContractorPlanBillingTab />}
        {tab === "data" && <ContractorDataTab />}
        {tab === "orgsec" && <ContractorOrgSecurityTab contractor={contractor} />}
        {tab === "integrations" && <ContractorIntegrationsTab contractor={contractor} />}
        {tab === "payments" && <ContractorPaymentsTab contractor={contractor} />}
        {tab === "compliance" && (
          <SubcontractorComplianceTab subcontractor={subcontractor} />
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function SettingsSubNav({
  tabs,
  tab,
  setTab,
}: {
  tabs: TabDescriptor[];
  tab: TabId;
  setTab: (t: TabId) => void;
}) {
  return (
    <nav
      className="settings-subnav"
      style={{
        background: "var(--s1)",
        border: "1px solid var(--s3)",
        borderRadius: 18,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        position: "sticky",
        top: "calc(var(--th) + 16px)",
      }}
    >
      {tabs.map((t) => {
        const on = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "11px 12px",
              borderRadius: 10,
              textAlign: "left",
              transition: "all 120ms",
              color: on ? "var(--ac-t)" : "var(--t2)",
              background: on ? "var(--ac-s)" : "transparent",
              cursor: "pointer",
              width: "100%",
              border: "none",
              fontFamily: "'Instrument Sans',system-ui,sans-serif",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: on ? "var(--ac)" : "var(--s2)",
                color: on ? "white" : "var(--t2)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                marginTop: 1,
                transition: "all 120ms",
              }}
            >
              {t.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  fontSize: 13,
                  fontWeight: 650,
                  letterSpacing: "-.01em",
                }}
              >
                {t.label}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--t3)",
                  marginTop: 2,
                  lineHeight: 1.35,
                  fontWeight: 500,
                }}
              >
                {t.desc}
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
}

// ═══════ PROFILE TAB ═══════════════════════════════════════════════════
function ProfileTab({ view }: { view: UserSettingsView }) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>(view.profile);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    view.avatarPreviewUrl,
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: profile.displayName ?? "",
        phone: profile.phone,
        title: profile.title,
        timezone: profile.timezone,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "save_failed");
      return;
    }
    setDirty(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2400);
  }

  function discard() {
    setProfile(view.profile);
    setDirty(false);
    setSaved(false);
    setError(null);
  }

  const initials = (profile.displayName ?? profile.email)
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      <Panel
        title="Your photo"
        subtitle="This appears on your messages, comments, and wherever you show up across the portal."
      >
        <AvatarUpload
          initials={initials}
          previewUrl={avatarPreview}
          displayName={profile.displayName ?? profile.email}
          onChange={(url) => {
            setAvatarPreview(url);
            router.refresh();
          }}
        />
      </Panel>

      <Panel
        title="Personal information"
        subtitle="Your contact info and how you're identified in the system."
      >
        <Field label="Full name">
          <input
            style={fieldStyle()}
            value={profile.displayName ?? ""}
            onChange={(e) => update("displayName", e.target.value)}
          />
        </Field>
        <FieldRow>
          <Field label="Email address" help="Used for sign-in and notifications. Contact support to change.">
            <input
              style={{ ...fieldStyle(), background: "var(--s2)", color: "var(--t2)" }}
              value={profile.email}
              readOnly
            />
          </Field>
          <Field label="Phone number" help="For urgent project alerts (optional)">
            <input
              type="tel"
              style={fieldStyle()}
              value={profile.phone ?? ""}
              onChange={(e) => update("phone", e.target.value || null)}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label={view.portalType === "residential" ? "Role in the household" : "Title or role"}>
            <input
              style={fieldStyle()}
              value={profile.title ?? ""}
              onChange={(e) => update("title", e.target.value || null)}
            />
          </Field>
          <Field label="Time zone">
            <select
              style={fieldStyle()}
              value={profile.timezone}
              onChange={(e) => update("timezone", e.target.value)}
            >
              <option value="America/Los_Angeles">Pacific Time — Los Angeles</option>
              <option value="America/Denver">Mountain Time — Denver</option>
              <option value="America/Chicago">Central Time — Chicago</option>
              <option value="America/New_York">Eastern Time — New York</option>
              <option value="America/Toronto">Eastern Time — Toronto</option>
              <option value="America/Vancouver">Pacific Time — Vancouver</option>
            </select>
          </Field>
        </FieldRow>
      </Panel>

      {(dirty || saved || error) && (
        <SaveBar
          state={error ? "dirty" : saved ? "success" : "dirty"}
          message={
            error
              ? error
              : saved
                ? "Profile saved"
                : "You have unsaved changes"
          }
          showActions={!saved && !error}
          onDiscard={discard}
          onSave={save}
          saving={saving}
        />
      )}
    </>
  );
}

function AvatarUpload({
  initials,
  previewUrl,
  displayName,
  onChange,
}: {
  initials: string;
  previewUrl: string | null;
  displayName: string;
  onChange: (nextPreviewUrl: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setError(null);
    if (file.size > 2 * 1024 * 1024) {
      setError("File is larger than 2MB.");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type)) {
      setError("Only PNG, JPEG, WEBP, or GIF are allowed.");
      return;
    }
    setUploading(true);
    try {
      const presignRes = await fetch("/api/avatar/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });
      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => ({}));
        setError(body.message ?? body.error ?? "presign_failed");
        return;
      }
      const { uploadUrl, storageKey } = await presignRes.json();

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) {
        setError(`Upload failed (${putRes.status})`);
        return;
      }

      const finRes = await fetch("/api/avatar/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey }),
      });
      if (!finRes.ok) {
        const body = await finRes.json().catch(() => ({}));
        setError(body.message ?? body.error ?? "finalize_failed");
        return;
      }
      const data = await finRes.json();
      onChange(data.previewUrl ?? null);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/avatar/finalize", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? body.error ?? "remove_failed");
        return;
      }
      onChange(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 0, flexWrap: "wrap" }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: previewUrl
            ? `url(${previewUrl}) center/cover no-repeat`
            : "linear-gradient(135deg,var(--ac),var(--ac-s))",
          color: "white",
          display: "grid",
          placeItems: "center",
          fontFamily: "'DM Sans',system-ui,sans-serif",
          fontSize: 26,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {!previewUrl && initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'DM Sans',system-ui,sans-serif",
            fontSize: 14,
            fontWeight: 650,
          }}
        >
          {displayName}
        </div>
        <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2, fontWeight: 500 }}>
          PNG, JPEG, WEBP, or GIF · square · up to 2MB
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={btnGhostSm()}
          >
            {uploading ? "Uploading…" : (<><span style={{ marginRight: 6 }}>{I.upload}</span>Upload new</>)}
          </button>
          {previewUrl && (
            <button onClick={handleRemove} disabled={uploading} style={btnGhostSm()}>
              Remove
            </button>
          )}
        </div>
        {error && (
          <div style={{ fontSize: 12, color: "var(--dg-t)", marginTop: 6, fontWeight: 520 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════ SECURITY TAB ══════════════════════════════════════════════════
function SecurityTab({ view }: { view: UserSettingsView }) {
  return (
    <>
      <PasswordPanel />
      <TwoFactorPanel view={view} />
      <SessionsPanel sessions={view.sessions} />
    </>
  );
}

function PasswordPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit() {
    setError(null);
    setSaved(false);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setSaving(true);
    const res = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error.message ?? "Password change failed.");
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  }

  return (
    <Panel
      title="Password"
      subtitle="Change your sign-in password. Use at least 8 characters with a mix of letters, numbers, and symbols."
    >
      <Field label="Current password">
        <PasswordField
          value={current}
          onChange={setCurrent}
          show={showCurrent}
          setShow={setShowCurrent}
          placeholder="Enter your current password"
        />
      </Field>
      <FieldRow>
        <Field label="New password">
          <PasswordField
            value={next}
            onChange={setNext}
            show={showNext}
            setShow={setShowNext}
            placeholder="At least 8 characters"
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type={showNext ? "text" : "password"}
            style={fieldStyle()}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter new password"
          />
        </Field>
      </FieldRow>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
          marginTop: 8,
        }}
      >
        {error && <span style={{ fontSize: 12, color: "var(--dg-t)", fontWeight: 520 }}>{error}</span>}
        {saved && !error && (
          <span style={{ fontSize: 12, color: "var(--ok-t)", fontWeight: 620 }}>Password updated</span>
        )}
        <button
          onClick={submit}
          disabled={!current || !next || next !== confirm || saving}
          style={btnPrimary(Boolean(current && next && next === confirm && !saving))}
        >
          {saving ? "Updating…" : "Update password"}
        </button>
      </div>
    </Panel>
  );
}

function PasswordField({
  value,
  onChange,
  show,
  setShow,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  placeholder: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        style={{ ...fieldStyle(), paddingRight: 40 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          width: 28,
          height: 28,
          borderRadius: 6,
          color: "var(--t3)",
          display: "grid",
          placeItems: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        {show ? I.eyeOff : I.eye}
      </button>
    </div>
  );
}

function TwoFactorPanel({ view }: { view: UserSettingsView }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(view.twoFactorEnabled);
  const [mode, setMode] = useState<"idle" | "setup" | "disable" | "codes">("idle");
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  async function beginEnable() {
    setError(null);
    setPending(true);
    // Better Auth's two-factor plugin: enable requires password; returns TOTP URI.
    const res = await authClient.twoFactor.enable({ password });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? "Enable failed.");
      return;
    }
    const data = res.data as { totpURI?: string; backupCodes?: string[] } | undefined;
    setTotpUri(data?.totpURI ?? null);
    setTotpSecret(extractSecretFromUri(data?.totpURI));
    setBackupCodes(data?.backupCodes ?? null);
  }

  async function verifyAndFinish() {
    setError(null);
    setPending(true);
    const res = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s+/g, "") });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? "Code did not verify.");
      return;
    }
    setEnabled(true);
    setMode("idle");
    setPassword("");
    setCode("");
    setTotpUri(null);
    setTotpSecret(null);
    router.refresh();
  }

  async function disable() {
    setError(null);
    setPending(true);
    const res = await authClient.twoFactor.disable({ password });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? "Disable failed.");
      return;
    }
    setEnabled(false);
    setMode("idle");
    setPassword("");
    router.refresh();
  }

  async function viewRecoveryCodes() {
    setError(null);
    setPending(true);
    const res = await authClient.twoFactor.generateBackupCodes({ password });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? "Could not fetch codes.");
      return;
    }
    const data = res.data as { backupCodes?: string[] } | undefined;
    setBackupCodes(data?.backupCodes ?? []);
    setMode("codes");
    setPassword("");
  }

  return (
    <Panel
      title="Two-factor authentication"
      subtitle="Add a second verification step when signing in from new devices."
    >
      <div
        style={{
          background: "var(--s2)",
          border: "1px solid var(--s3)",
          borderRadius: 14,
          padding: 18,
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: enabled ? "var(--ok-s)" : "var(--s1)",
            color: enabled ? "var(--ok-t)" : "var(--ac)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          {I.shield}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h4
              style={{
                fontFamily: "'DM Sans',system-ui,sans-serif",
                fontSize: 14,
                fontWeight: 650,
                letterSpacing: "-.01em",
                margin: 0,
              }}
            >
              Authenticator app
            </h4>
            <span style={pillStyle(enabled ? "ok" : "off")}>
              {enabled ? "Enabled" : "Off"}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 4, fontWeight: 500, lineHeight: 1.45 }}>
            Use Google Authenticator, 1Password, Authy, or any TOTP app to generate sign-in codes.
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {enabled && mode === "idle" && (
              <>
                <button style={btnGhostSm()} onClick={() => setMode("codes")}>
                  View recovery codes
                </button>
                <button style={btnDangerSm()} onClick={() => setMode("disable")}>
                  Disable
                </button>
              </>
            )}
            {!enabled && mode === "idle" && (
              <button style={btnPrimarySm(true)} onClick={() => setMode("setup")}>
                Set up authenticator
              </button>
            )}
            {mode !== "idle" && (
              <button
                style={btnGhostSm()}
                onClick={() => {
                  setMode("idle");
                  setPassword("");
                  setCode("");
                  setError(null);
                  setTotpUri(null);
                  setTotpSecret(null);
                }}
              >
                Cancel
              </button>
            )}
          </div>

          {mode === "setup" && (
            <div style={setupBoxStyle()}>
              {!totpUri ? (
                <div>
                  <h5 style={setupStepTitleStyle()}>Confirm your password</h5>
                  <p style={setupStepPStyle()}>
                    We need your password to enroll this account in two-factor authentication.
                  </p>
                  <input
                    type="password"
                    placeholder="Current password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...fieldStyle(), maxWidth: 320 }}
                  />
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button
                      style={btnPrimarySm(Boolean(password) && !pending)}
                      onClick={beginEnable}
                      disabled={!password || pending}
                    >
                      {pending ? "Enrolling…" : "Continue"}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h5 style={setupStepTitleStyle()}>Step 1 — Scan the QR code</h5>
                  <p style={setupStepPStyle()}>
                    Open your authenticator app and scan this code, or enter the secret manually.
                  </p>
                  <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <TotpQr uri={totpUri} />
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 8, fontWeight: 500 }}>
                        Or enter manually:
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background: "var(--s1)",
                          border: "1px solid var(--s3)",
                          borderRadius: 10,
                          padding: "8px 12px",
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: 12,
                          letterSpacing: ".06em",
                          width: "fit-content",
                        }}
                      >
                        <span>{totpSecret ?? "—"}</span>
                        <button
                          onClick={() => totpSecret && navigator.clipboard.writeText(totpSecret)}
                          style={{
                            color: "var(--t3)",
                            display: "grid",
                            placeItems: "center",
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                          }}
                          title="Copy"
                        >
                          {I.copy}
                        </button>
                      </div>
                    </div>
                  </div>
                  <h5 style={{ ...setupStepTitleStyle(), marginTop: 16 }}>Step 2 — Enter the 6-digit code</h5>
                  <p style={setupStepPStyle()}>Type the code your authenticator is showing right now.</p>
                  <input
                    placeholder="000 000"
                    maxLength={7}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{
                      ...fieldStyle(),
                      width: 160,
                      fontFamily: "'JetBrains Mono',monospace",
                      letterSpacing: ".2em",
                      fontSize: 15,
                    }}
                  />
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button
                      style={btnPrimarySm(code.length >= 6 && !pending)}
                      onClick={verifyAndFinish}
                      disabled={code.length < 6 || pending}
                    >
                      {pending ? "Verifying…" : "Verify & enable"}
                    </button>
                  </div>
                  {backupCodes && backupCodes.length > 0 && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: 12,
                        background: "var(--wr-s)",
                        border: "1px solid var(--wr)",
                        borderRadius: 10,
                        fontSize: 12,
                        color: "var(--wr-t)",
                        fontWeight: 520,
                      }}
                    >
                      <strong>Save these recovery codes</strong> — you can use one if you lose access to your authenticator.
                      <div
                        style={{
                          marginTop: 6,
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: 12,
                          letterSpacing: ".04em",
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                          gap: 4,
                        }}
                      >
                        {backupCodes.map((c) => (
                          <span key={c}>{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === "disable" && (
            <div style={setupBoxStyle()}>
              <h5 style={setupStepTitleStyle()}>Confirm your password to disable 2FA</h5>
              <p style={setupStepPStyle()}>
                You&apos;ll sign in with only your password after this.
              </p>
              <input
                type="password"
                placeholder="Current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...fieldStyle(), maxWidth: 320 }}
              />
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button
                  style={btnDangerSm()}
                  onClick={disable}
                  disabled={!password || pending}
                >
                  {pending ? "Disabling…" : "Disable 2FA"}
                </button>
              </div>
            </div>
          )}

          {mode === "codes" && (
            <div style={setupBoxStyle()}>
              {backupCodes == null ? (
                <>
                  <h5 style={setupStepTitleStyle()}>Confirm your password to view codes</h5>
                  <p style={setupStepPStyle()}>
                    Generating new codes invalidates any previous set.
                  </p>
                  <input
                    type="password"
                    placeholder="Current password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...fieldStyle(), maxWidth: 320 }}
                  />
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button
                      style={btnPrimarySm(Boolean(password) && !pending)}
                      onClick={viewRecoveryCodes}
                      disabled={!password || pending}
                    >
                      {pending ? "Generating…" : "Generate new codes"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h5 style={setupStepTitleStyle()}>Your recovery codes</h5>
                  <p style={setupStepPStyle()}>
                    Store these somewhere safe. Each can be used once to sign in if you lose your authenticator.
                  </p>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 13,
                      letterSpacing: ".04em",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                      gap: 6,
                      padding: 12,
                      background: "var(--s1)",
                      border: "1px solid var(--s3)",
                      borderRadius: 10,
                    }}
                  >
                    {backupCodes.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: "var(--dg-t)", marginTop: 10, fontWeight: 520 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function TotpQr({ uri }: { uri: string }) {
  // Use a data-URI QR via a lightweight external service (chart.googleapis fallback
  // to qrserver.com). Keeps bundle small; production can swap for an inline JS QR.
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(uri)}`;
  return (
    <div
      style={{
        width: 140,
        height: 140,
        background: "white",
        border: "1px solid var(--s3)",
        borderRadius: 10,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Authenticator QR code" width={140} height={140} />
    </div>
  );
}

function extractSecretFromUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const match = uri.match(/[?&]secret=([^&]+)/);
  if (!match) return null;
  const secret = decodeURIComponent(match[1]);
  // Format for display in 4-char groups.
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

function SessionsPanel({ sessions }: { sessions: ActiveSession[] }) {
  const router = useRouter();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revokeOne(sessionId: string) {
    setError(null);
    setRevoking(sessionId);
    const res = await fetch("/api/user/sessions/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    setRevoking(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "Could not revoke session.");
      return;
    }
    router.refresh();
  }

  async function revokeOthers() {
    setError(null);
    setRevoking("others");
    const res = await fetch("/api/user/sessions/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revokeOthers: true }),
    });
    setRevoking(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "Could not revoke other sessions.");
      return;
    }
    router.refresh();
  }

  return (
    <Panel
      title="Active sessions"
      subtitle="Devices currently signed in with your account. Sign out any session you don't recognize."
    >
      {sessions.length === 0 ? (
        <div
          style={{
            padding: 20,
            border: "1px dashed var(--s3)",
            borderRadius: 12,
            textAlign: "center",
            color: "var(--t3)",
            fontSize: 13,
            fontWeight: 520,
          }}
        >
          No active sessions found.
        </div>
      ) : (
        sessions.map((s) => (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: 14,
              border: `1px solid ${s.isCurrent ? "var(--ac-m)" : "var(--s3)"}`,
              background: s.isCurrent ? "var(--ac-s)" : "transparent",
              borderRadius: 14,
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: s.isCurrent ? "var(--s1)" : "var(--s2)",
                color: s.isCurrent ? "var(--ac-t)" : "var(--t2)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              {/iPhone|iPad|Android/i.test(s.device) ? I.phone : I.laptop}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  fontSize: 13.5,
                  fontWeight: 650,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {s.device} · {s.browser}
                {s.isCurrent && <span style={pillStyle("ok")}>This device</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 3, fontWeight: 500 }}>
                {s.ipAddress ?? "Unknown IP"}
              </div>
            </div>
            <div
              style={{
                fontSize: 11.5,
                fontFamily: "'JetBrains Mono',monospace",
                color: s.isCurrent ? "var(--ok-t)" : "var(--t2)",
                fontWeight: s.isCurrent ? 600 : 500,
              }}
            >
              {formatRelativeTime(s.lastActiveAt)}
            </div>
            {!s.isCurrent && (
              <button
                onClick={() => revokeOne(s.id)}
                disabled={revoking === s.id}
                style={btnGhostSm()}
              >
                {revoking === s.id ? "…" : "Sign out"}
              </button>
            )}
          </div>
        ))
      )}

      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center" }}>
        {error && <span style={{ fontSize: 12, color: "var(--dg-t)", fontWeight: 520 }}>{error}</span>}
        <button
          style={btnDangerSm()}
          onClick={revokeOthers}
          disabled={revoking === "others" || sessions.filter((s) => !s.isCurrent).length === 0}
        >
          {revoking === "others" ? "Signing out…" : "Sign out everywhere else"}
        </button>
      </div>
    </Panel>
  );
}

function formatRelativeTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "Active now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// ═══════ NOTIFICATIONS TAB ═════════════════════════════════════════════
function NotificationsTab({ view }: { view: UserSettingsView }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPrefState>(view.notificationPrefs);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(eventId: string, channel: "email" | "inApp") {
    setPrefs((prev) => ({
      ...prev,
      [eventId]: { ...prev[eventId], [channel]: !prev[eventId][channel] },
    }));
    setDirty(true);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const body = {
      portalType: view.portalType,
      preferences: Object.entries(prefs).map(([eventId, v]) => ({
        eventId,
        email: v.email,
        inApp: v.inApp,
      })),
    };
    const res = await fetch("/api/user/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.message ?? b.error ?? "save_failed");
      return;
    }
    setDirty(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2400);
  }

  async function reset() {
    setError(null);
    setSaving(true);
    const res = await fetch("/api/user/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portalType: view.portalType, reset: true }),
    });
    setSaving(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.message ?? b.error ?? "reset_failed");
      return;
    }
    router.refresh();
  }

  const subtitle =
    view.portalType === "residential"
      ? "Choose how you'd like to hear from your builder — email, in-app, or both."
      : view.portalType === "commercial"
        ? "Choose how you'd like to stay informed about project activity."
        : "Choose which events reach you by email and which show in your in-app inbox.";

  return (
    <Panel
      title="Notification preferences"
      subtitle={subtitle}
      headerRight={
        <button onClick={reset} disabled={saving} style={btnGhostSm()}>
          Reset to defaults
        </button>
      }
    >
      {NOTIFICATION_GROUPS[view.portalType].map((group) => (
        <div key={group.group} style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: "'DM Sans',system-ui,sans-serif",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--t3)",
              textTransform: "uppercase",
              letterSpacing: ".06em",
              padding: "0 4px 10px",
              borderBottom: "1px solid var(--s3)",
              marginBottom: 6,
              display: "grid",
              gridTemplateColumns: "1fr 70px 70px",
              gap: 20,
              alignItems: "center",
            }}
          >
            <span>{group.group}</span>
            <span style={{ textAlign: "center", fontSize: 11, color: "var(--t3)" }}>Email</span>
            <span style={{ textAlign: "center", fontSize: 11, color: "var(--t3)" }}>In-app</span>
          </div>
          {group.events.map((ev) => {
            const p = prefs[ev.id] ?? { email: false, inApp: true };
            return (
              <div
                key={ev.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 70px 70px",
                  gap: 20,
                  alignItems: "center",
                  padding: "12px 4px",
                  borderBottom: "1px solid var(--s2)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "var(--t1)",
                      fontFamily: "'DM Sans',system-ui,sans-serif",
                      letterSpacing: "-.01em",
                    }}
                  >
                    {ev.label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2, fontWeight: 500, lineHeight: 1.4 }}>
                    {ev.desc}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Toggle
                    on={p.email}
                    onChange={() => toggle(ev.id, "email")}
                    ariaLabel={`Email notifications for ${ev.label}`}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Toggle
                    on={p.inApp}
                    onChange={() => toggle(ev.id, "inApp")}
                    ariaLabel={`In-app notifications for ${ev.label}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {(dirty || saved || error) && (
        <div style={{ marginTop: 14 }}>
          <SaveBar
            state={error ? "dirty" : saved ? "success" : "dirty"}
            message={
              error
                ? error
                : saved
                  ? "Notification preferences saved"
                  : "You have unsaved changes"
            }
            showActions={!saved && !error}
            onDiscard={() => {
              setPrefs(view.notificationPrefs);
              setDirty(false);
            }}
            onSave={save}
            saving={saving}
          />
        </div>
      )}
    </Panel>
  );
}

// ═══════ APPEARANCE TAB ════════════════════════════════════════════════
function AppearanceTab({
  view,
  showDangerZone,
}: {
  view: UserSettingsView;
  showDangerZone: boolean;
}) {
  const router = useRouter();
  const [theme, setThemeState] = useState(view.profile.theme);
  const [density, setDensity] = useState(view.profile.density);
  const [language, setLanguage] = useState(view.profile.language);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Apply theme imperatively to <html>.
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const effectiveDark =
        theme === "dark" ||
        (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", effectiveDark);
      try {
        localStorage.setItem("builtcrm-theme", theme);
      } catch {
        /* ignore */
      }
    };
    apply();
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  async function persist(partial: { theme?: string; density?: string; language?: string }) {
    setSaving(true);
    const res = await fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <>
      <Panel
        title="Theme"
        subtitle="Choose how BuiltCRM looks. System follows your device's setting automatically."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 12,
            marginTop: 8,
          }}
        >
          {(
            [
              { id: "light", label: "Light", desc: "Bright, warm surfaces" },
              { id: "dark", label: "Dark", desc: "Easier on the eyes at night" },
              { id: "system", label: "System", desc: "Match your device" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setThemeState(t.id);
                persist({ theme: t.id });
              }}
              style={{
                padding: 14,
                border: `1.5px solid ${theme === t.id ? "var(--ac)" : "var(--s3)"}`,
                borderRadius: 14,
                cursor: "pointer",
                textAlign: "left",
                background: theme === t.id ? "var(--ac-s)" : "var(--s1)",
                transition: "all 120ms",
              }}
            >
              <div
                style={{
                  height: 64,
                  borderRadius: 10,
                  marginBottom: 10,
                  position: "relative",
                  overflow: "hidden",
                  border: "1px solid var(--s3)",
                  background:
                    t.id === "light"
                      ? "#fff"
                      : t.id === "dark"
                        ? "#0c0e14"
                        : "linear-gradient(90deg,#fff 50%,#0c0e14 50%)",
                }}
              />
              <div
                style={{
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  fontSize: 13,
                  fontWeight: 650,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                {t.label}
                {theme === t.id && <span style={{ color: "var(--ac)" }}>{I.check}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 2, fontWeight: 500 }}>
                {t.desc}
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel
        title="Display density"
        subtitle="Controls how tightly information is packed. Compact fits more on screen, comfortable is easier to scan."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {(
            [
              { id: "comfortable", label: "Comfortable", desc: "Generous spacing (default)" },
              { id: "compact", label: "Compact", desc: "Tighter rows — good for power users" },
            ] as const
          ).map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setDensity(d.id);
                persist({ density: d.id });
              }}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 14px",
                border: `1px solid ${density === d.id ? "var(--ac)" : "var(--s3)"}`,
                borderRadius: 10,
                cursor: "pointer",
                transition: "all 120ms",
                background: density === d.id ? "var(--ac-s)" : "var(--s1)",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: `2px solid ${density === d.id ? "var(--ac)" : "var(--s4)"}`,
                  background: density === d.id ? "var(--ac)" : "transparent",
                  flexShrink: 0,
                  marginTop: 1,
                  position: "relative",
                }}
              >
                {density === d.id && (
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      left: 3,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "white",
                    }}
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    fontSize: 13.5,
                    fontWeight: 640,
                    letterSpacing: "-.01em",
                  }}
                >
                  {d.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2, fontWeight: 500, lineHeight: 1.4 }}>
                  {d.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel
        title="Language"
        subtitle="The language used throughout the app. More languages coming soon."
      >
        <Field label="Language" help="Your selection affects dates, numbers, and currency formatting too.">
          <select
            style={{ ...fieldStyle(), maxWidth: 320 }}
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              persist({ language: e.target.value });
            }}
          >
            <option value="en">English (United States)</option>
            <option value="en-CA">English (Canada)</option>
            <option value="fr-CA" disabled>
              Français (Canada) — coming soon
            </option>
            <option value="es" disabled>
              Español — coming soon
            </option>
          </select>
        </Field>
      </Panel>

      {showDangerZone && (
        <div
          style={{
            background: "var(--dg-s)",
            border: "1px solid var(--dg)",
            borderRadius: 18,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <h3
            style={{
              fontFamily: "'DM Sans',system-ui,sans-serif",
              fontSize: 15,
              fontWeight: 700,
              color: "var(--dg)",
              marginBottom: 4,
              margin: 0,
            }}
          >
            Danger zone
          </h3>
          <p
            style={{
              fontSize: 12.5,
              color: "var(--dg)",
              opacity: 0.85,
              marginBottom: 12,
              marginTop: 4,
              fontWeight: 500,
              lineHeight: 1.45,
            }}
          >
            Delete your personal account and end your access to all portals you belong to. This
            won&apos;t delete organization data — talk to your admin first.
          </p>
          <button style={btnDangerSm()} onClick={() => setShowDelete(true)}>
            Delete my account
          </button>
        </div>
      )}

      {saved && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "var(--ok-s)",
            color: "var(--ok-t)",
            border: "1px solid var(--ok)",
            padding: "10px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 620,
            fontFamily: "'DM Sans',system-ui,sans-serif",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {I.check} Preferences saved
        </div>
      )}
      {saving && !saved && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "var(--s1)",
            color: "var(--t2)",
            border: "1px solid var(--s3)",
            padding: "10px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'DM Sans',system-ui,sans-serif",
            zIndex: 60,
          }}
        >
          Saving…
        </div>
      )}

      {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} />}
    </>
  );
}

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--s1)",
          borderRadius: 18,
          border: "1px solid var(--s3)",
          padding: 24,
        }}
      >
        <h3
          style={{
            fontFamily: "'DM Sans',system-ui,sans-serif",
            fontSize: 18,
            fontWeight: 740,
            letterSpacing: "-.015em",
            margin: 0,
          }}
        >
          Delete account
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--t2)",
            marginTop: 8,
            fontWeight: 520,
            lineHeight: 1.55,
          }}
        >
          Self-serve account deletion isn&apos;t live yet. To delete your account, email{" "}
          <strong>support@builtcrm.com</strong> from this account&apos;s email address and we&apos;ll take it
          from there.
        </p>
        <p
          style={{
            fontSize: 12.5,
            color: "var(--t3)",
            marginTop: 10,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          We review deletion requests to preserve project records you&apos;re party to — for example,
          signed lien waivers or approvals you&apos;ve issued on a project stay tied to the project
          even after your account is closed.
        </p>
        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button style={btnGhostSm()} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared primitives ───────────────────────────────────────────────────
function Panel({
  title,
  subtitle,
  headerRight,
  children,
}: {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--s1)",
        border: "1px solid var(--s3)",
        borderRadius: 18,
        padding: 24,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          marginBottom: 18,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: "'DM Sans',system-ui,sans-serif",
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "-.02em",
              margin: 0,
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              style={{
                fontSize: 13,
                color: "var(--t2)",
                marginTop: 3,
                fontWeight: 520,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
      <label
        style={{
          fontFamily: "'DM Sans',system-ui,sans-serif",
          fontSize: 12,
          fontWeight: 650,
          color: "var(--t2)",
          letterSpacing: ".01em",
        }}
      >
        {label}
      </label>
      {children}
      {help && (
        <div style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 2, fontWeight: 500 }}>
          {help}
        </div>
      )}
    </div>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return (
    <div
      className="field-row"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
    >
      <style>{`@media (max-width: 620px) { .field-row { grid-template-columns: 1fr !important; } }`}</style>
      {children}
    </div>
  );
}

function SaveBar({
  state,
  message,
  showActions,
  onDiscard,
  onSave,
  saving,
}: {
  state: "dirty" | "success";
  message: string;
  showActions: boolean;
  onDiscard: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const bg = state === "success" ? "var(--ok-s)" : "var(--wr-s)";
  const border = state === "success" ? "var(--ok)" : "var(--wr)";
  const color = state === "success" ? "var(--ok-t)" : "var(--wr-t)";
  const dotColor = state === "success" ? "var(--ok)" : "var(--wr)";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 20px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 14,
        marginTop: 12,
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 580, color }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
          }}
        />
        {message}
      </div>
      {showActions && (
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnGhostSm()} onClick={onDiscard}>
            Discard
          </button>
          <button
            style={btnPrimarySm(!saving)}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Saving…" : (<><span style={{ marginRight: 6 }}>{I.check}</span>Save changes</>)}
          </button>
        </div>
      )}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  ariaLabel,
}: {
  on: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={onChange}
      style={{
        width: 32,
        height: 18,
        background: on ? "var(--ac)" : "var(--s3)",
        borderRadius: 999,
        border: "none",
        position: "relative",
        cursor: "pointer",
        transition: "background 120ms",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 16 : 2,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,.15)",
          transition: "left 200ms cubic-bezier(.16,1,.3,1)",
        }}
      />
    </button>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
function fieldStyle(): CSSProperties {
  return {
    height: 40,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid var(--s3)",
    background: "var(--s1)",
    fontSize: 13.5,
    color: "var(--t1)",
    outline: "none",
    fontFamily: "'Instrument Sans',system-ui,sans-serif",
    width: "100%",
  };
}

function btnPrimary(enabled: boolean): CSSProperties {
  return {
    height: 38,
    padding: "0 18px",
    borderRadius: 10,
    background: enabled ? "var(--ac)" : "var(--s3)",
    color: enabled ? "white" : "var(--t3)",
    border: "none",
    fontFamily: "'Instrument Sans',system-ui,sans-serif",
    fontSize: 13,
    fontWeight: 650,
    cursor: enabled ? "pointer" : "not-allowed",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  };
}

function btnPrimarySm(enabled: boolean): CSSProperties {
  return { ...btnPrimary(enabled), height: 32, padding: "0 14px", fontSize: 12 };
}

function btnGhostSm(): CSSProperties {
  return {
    height: 32,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid var(--s3)",
    background: "transparent",
    color: "var(--t2)",
    fontFamily: "'Instrument Sans',system-ui,sans-serif",
    fontSize: 12,
    fontWeight: 650,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };
}

function btnDangerSm(): CSSProperties {
  return {
    height: 32,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid var(--dg)",
    background: "transparent",
    color: "var(--dg)",
    fontFamily: "'Instrument Sans',system-ui,sans-serif",
    fontSize: 12,
    fontWeight: 650,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };
}

function pillStyle(tone: "ok" | "off" | "warn"): CSSProperties {
  const map: Record<typeof tone, { bg: string; color: string }> = {
    ok: { bg: "var(--ok-s)", color: "var(--ok-t)" },
    off: { bg: "var(--s3)", color: "var(--t2)" },
    warn: { bg: "var(--wr-s)", color: "var(--wr-t)" },
  };
  const s = map[tone];
  return {
    fontSize: 10.5,
    fontWeight: 700,
    padding: "3px 9px",
    borderRadius: 999,
    whiteSpace: "nowrap",
    fontFamily: "'DM Sans',system-ui,sans-serif",
    letterSpacing: ".02em",
    background: s.bg,
    color: s.color,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
  };
}

function setupBoxStyle(): CSSProperties {
  return {
    background: "var(--s1)",
    borderRadius: 14,
    padding: 18,
    marginTop: 14,
    border: "1px solid var(--s3)",
  };
}

function setupStepTitleStyle(): CSSProperties {
  return {
    fontFamily: "'DM Sans',system-ui,sans-serif",
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
    marginTop: 0,
  };
}

function setupStepPStyle(): CSSProperties {
  return {
    fontSize: 12.5,
    color: "var(--t2)",
    marginBottom: 8,
    marginTop: 0,
    fontWeight: 520,
  };
}

// ═══════ CONTRACTOR: INTEGRATIONS TAB ══════════════════════════════════
type IntegrationPill = { text: string; tone?: PillTone };
type Integration = {
  id: string;
  name: string;
  provider: string;
  logo: string;
  logoCls: "qb" | "stripe" | "xero" | "sage" | "gcal" | "email" | "csv" | "webhook";
  desc: string;
  state: "connected" | "available";
  alwaysOn?: boolean;
  statusLabel: string;
  statusMeta?: string;
  pills?: IntegrationPill[];
  btn?: string;
  gated?: boolean;
  extraPill?: IntegrationPill;
};

const INTEGRATIONS: Integration[] = [
  {
    id: "qb",
    name: "QuickBooks Online",
    provider: "Accounting · Intuit",
    logo: "QB",
    logoCls: "qb",
    desc: "Push approved draw requests as invoices. Pull payment confirmations automatically. Map SOV cost codes to your chart of accounts.",
    state: "connected",
    statusLabel: "Connected",
    statusMeta: "Last sync 2h ago",
    pills: [
      { text: "Healthy", tone: "ok" },
      { text: "4 projects mapped" },
      { text: "127 syncs this month" },
    ],
  },
  {
    id: "stripe",
    name: "Stripe Payments",
    provider: "Payment processing · ACH & Card",
    logo: "S",
    logoCls: "stripe",
    desc: "Accept draw payments via ACH bank transfer or credit card. Funds route directly to your bank account through Stripe Connect.",
    state: "connected",
    statusLabel: "Connected",
    statusMeta: "Payouts active",
    pills: [
      { text: "Verified", tone: "ok" },
      { text: "$287,000 processed" },
      { text: "ACH + Card enabled" },
    ],
  },
  {
    id: "xero",
    name: "Xero",
    provider: "Accounting · Xero Limited",
    logo: "X",
    logoCls: "xero",
    desc: "Sync invoices and payment status with Xero. Same capabilities as QuickBooks — choose the accounting system your team already uses.",
    state: "available",
    statusLabel: "Not connected",
    btn: "Connect Xero",
  },
  {
    id: "sage",
    name: "Sage Business Cloud",
    provider: "Accounting · Sage Group",
    logo: "S",
    logoCls: "sage",
    desc: "Sync billing data with Sage Business Cloud Accounting. Invoices, payments, and journal entries flow automatically.",
    state: "available",
    statusLabel: "Not connected",
    btn: "Connect Sage",
  },
  {
    id: "gcal",
    name: "Calendar Sync",
    provider: "iCal feed · Google / Outlook / Apple",
    logo: "\u{1F4C5}",
    logoCls: "gcal",
    desc: "Subscribe to your project milestones and inspection dates as a calendar feed. Works with any calendar app that supports iCal.",
    state: "available",
    statusLabel: "Not set up",
    btn: "Generate feed URL",
    extraPill: { text: "All plans" },
  },
  {
    id: "email",
    name: "Email Notifications",
    provider: "Transactional email · Reply-by-email",
    logo: "\u2709",
    logoCls: "email",
    desc: "Automatic email notifications for RFIs, approvals, draws, and messages. Reply directly from your inbox to post messages in BuiltCRM.",
    state: "connected",
    alwaysOn: true,
    statusLabel: "Active",
    statusMeta: "Always on",
    pills: [
      { text: "Healthy", tone: "ok" },
      { text: "All plans" },
      { text: "Reply-by-email enabled" },
    ],
  },
  {
    id: "csv",
    name: "CSV / Excel Import",
    provider: "Bulk data import · Self-service",
    logo: "file",
    logoCls: "csv",
    desc: "Import projects, budgets, contacts, milestones, and RFIs from CSV or Excel files. Column mapping wizard with validation preview.",
    state: "available",
    statusLabel: "No imports yet",
    btn: "Start import",
    extraPill: { text: "Professional+" },
  },
  {
    id: "webhook",
    name: "Webhook API",
    provider: "Custom integrations · Outbound events",
    logo: "link",
    logoCls: "webhook",
    desc: "Subscribe to BuiltCRM events and receive HTTP callbacks to your own systems. HMAC-signed payloads with automatic retries.",
    state: "available",
    statusLabel: "Enterprise plan required",
    gated: true,
    extraPill: { text: "Enterprise", tone: "accent" },
  },
];

const QB_MAPPINGS = [
  { project: "Riverside Tower Fit-Out", type: "Commercial · $2.4M", external: "Riverside Holdings LLC : Tower Fit-Out", invoices: 8, lastSync: "2h ago" },
  { project: "14 Maple Lane Renovation", type: "Residential · $410K", external: "Chen Family : Maple Lane Reno", invoices: 5, lastSync: "2h ago" },
  { project: "King St Office Build-Out", type: "Commercial · $890K", external: "Apex Ventures : King St Office", invoices: 6, lastSync: "2h ago" },
  { project: "Harbour View Condo Finishing", type: "Residential · $320K", external: "Thompson, R : Harbour View", invoices: 4, lastSync: "2h ago" },
];

type SyncLogEntry = {
  icon: "push" | "pull" | "reconcile";
  title: string;
  desc: string;
  time: string;
  status: "success" | "error";
};
const SYNC_LOG: SyncLogEntry[] = [
  { icon: "push", title: "Invoice pushed — Draw #5 · Riverside Tower", desc: "Created Invoice INV-00892 for $45,100.00 in QuickBooks", time: "2h ago", status: "success" },
  { icon: "pull", title: "Payment confirmed — Draw #4 · Riverside Tower", desc: 'QB Payment #PMT-4821 for $38,200.00 matched to Draw #4. Status updated to "Paid".', time: "2h ago", status: "success" },
  { icon: "push", title: "Invoice pushed — Draw #3 · 14 Maple Lane", desc: "Created Invoice INV-00889 for $22,750.00 in QuickBooks", time: "Yesterday", status: "success" },
  { icon: "reconcile", title: "Daily reconciliation completed", desc: "Checked 12 open invoices across 4 projects. All balances match. No discrepancies found.", time: "Yesterday · 6:00 AM", status: "success" },
  { icon: "push", title: "Change order journal entry — CO #7 · King St Office", desc: "Posted +$34,500 contract adjustment to Job: King St Office in QuickBooks", time: "Apr 11", status: "success" },
  { icon: "pull", title: "Payment confirmed — Draw #2 · Harbour View", desc: 'QB Payment #PMT-4798 for $18,900.00 matched. Status updated to "Paid".', time: "Apr 10", status: "success" },
];

type IntFilter = "all" | "connected" | "available";
type QbDetailTab = "overview" | "project mapping" | "sync activity" | "settings";

function ContractorIntegrationsTab({
  contractor,
}: {
  contractor?: ContractorSettingsBundle;
}) {
  if (contractor?.integrations) {
    return (
      <IntegrationsView
        view={contractor.integrations}
        nowMs={contractor.nowMs}
      />
    );
  }
  return <ContractorIntegrationsSampleTab />;
}

function ContractorIntegrationsSampleTab() {
  const [intFilter, setIntFilter] = useState<IntFilter>("all");
  const [detailTab, setDetailTab] = useState<QbDetailTab>("overview");

  const filteredInt = INTEGRATIONS.filter((i) => {
    if (intFilter === "all") return true;
    if (intFilter === "connected") return i.state === "connected";
    return i.state === "available";
  });
  const connectedCount = INTEGRATIONS.filter((i) => i.state === "connected").length;

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <h2
          style={{
            fontFamily: "'DM Sans',system-ui,sans-serif",
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-.03em",
            margin: 0,
          }}
        >
          Integrations
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--t2)",
            marginTop: 4,
            maxWidth: 640,
            fontWeight: 520,
            marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          Connect your accounting, payment, and productivity tools. Integrations sync automatically — no manual data entry required.
        </p>
      </div>

      <SegmentedTabs
        value={intFilter}
        onChange={(v) => setIntFilter(v as IntFilter)}
        options={[
          { value: "all", label: "All integrations" },
          { value: "connected", label: "Connected", badge: connectedCount },
          { value: "available", label: "Available" },
        ]}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
          gap: 14,
          margin: "16px 0 24px",
        }}
      >
        {filteredInt.map((int) => (
          <IntegrationCard key={int.id} int={int} />
        ))}
      </div>

      <div
        style={{
          background: "var(--s1)",
          border: "1px solid var(--s3)",
          borderRadius: 18,
          boxShadow: "var(--shsm)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 20,
            borderBottom: "1px solid var(--s3)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "linear-gradient(135deg,#2ca01c,#108a00)",
                color: "white",
                display: "grid",
                placeItems: "center",
                fontFamily: "'DM Sans',system-ui,sans-serif",
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              QB
            </div>
            <div>
              <h3
                style={{
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  fontSize: 17,
                  fontWeight: 720,
                  letterSpacing: "-.015em",
                  margin: 0,
                }}
              >
                QuickBooks Online
              </h3>
              <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 3, fontWeight: 520 }}>
                Connected to &quot;Pearson Construction Inc.&quot; · Realm ID:{" "}
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                  4620816365014389500
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            <button style={btnGhostSm()}>Sync now</button>
            <button style={btnGhostSm()}>Edit mapping</button>
            <button style={btnDangerSm()}>Disconnect</button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            margin: "16px 20px 0",
            background: "var(--s2)",
            borderRadius: 14,
            padding: 4,
            flexWrap: "wrap",
          }}
        >
          {(["overview", "project mapping", "sync activity", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setDetailTab(t)}
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: detailTab === t ? 650 : 620,
                color: detailTab === t ? "var(--t1)" : "var(--t2)",
                background: detailTab === t ? "var(--s1)" : "transparent",
                boxShadow: detailTab === t ? "var(--shsm)" : "none",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                textTransform: "capitalize",
                fontFamily: "'Instrument Sans',system-ui,sans-serif",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {detailTab === "overview" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                gap: 10,
              }}
            >
              {[
                { label: "Status", value: "Healthy", meta: "0 errors in last 7 days", tone: "ok" as const },
                { label: "Last sync", value: "2h ago", meta: "Apr 13 · 10:14 AM" },
                { label: "Invoices synced", value: "23", meta: "$1.2M total value pushed" },
                { label: "Payments received", value: "19", meta: "$982K confirmed via QB" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: s.tone === "ok" ? "var(--ok-s)" : "var(--s2)",
                    border: `1px solid ${s.tone === "ok" ? "var(--ok)" : "var(--s3)"}`,
                    borderRadius: 14,
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                      color: "var(--t3)",
                      fontWeight: 700,
                      fontFamily: "'DM Sans',system-ui,sans-serif",
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Sans',system-ui,sans-serif",
                      fontSize: 18,
                      fontWeight: 820,
                      letterSpacing: "-.03em",
                      marginTop: 4,
                      color: s.tone === "ok" ? "var(--ok-t)" : "var(--t1)",
                    }}
                  >
                    {s.value}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--t2)", marginTop: 3, fontWeight: 520 }}>
                    {s.meta}
                  </div>
                </div>
              ))}
            </div>
          )}

          {detailTab === "project mapping" && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <h3
                    style={{
                      fontFamily: "'DM Sans',system-ui,sans-serif",
                      fontSize: 15,
                      fontWeight: 720,
                      letterSpacing: "-.01em",
                      margin: 0,
                    }}
                  >
                    Project mapping
                  </h3>
                  <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2, fontWeight: 520 }}>
                    BuiltCRM projects matched to QuickBooks customers/jobs
                  </div>
                </div>
                <button style={btnGhostSm()}>Add mapping</button>
              </div>
              <div
                style={{
                  overflow: "auto",
                  border: "1px solid var(--s3)",
                  borderRadius: 14,
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                  <thead>
                    <tr>
                      {["BuiltCRM Project", "", "QuickBooks Customer / Job", "Invoices", "Last sync", "Status"].map(
                        (h, i) => (
                          <th
                            key={i}
                            style={{
                              textAlign: "left",
                              fontFamily: "'DM Sans',system-ui,sans-serif",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--t3)",
                              textTransform: "uppercase",
                              letterSpacing: ".06em",
                              padding: "8px 12px",
                              borderBottom: "2px solid var(--s3)",
                              background: "var(--s2)",
                            }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {QB_MAPPINGS.map((m, i) => (
                      <tr key={i}>
                        <td
                          style={{
                            padding: "10px 12px",
                            borderBottom: "1px solid var(--s3)",
                            fontSize: 13,
                          }}
                        >
                          <strong>{m.project}</strong>
                          <br />
                          <span style={{ fontSize: 11, color: "var(--t3)" }}>{m.type}</span>
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            borderBottom: "1px solid var(--s3)",
                            color: "var(--t3)",
                            fontSize: 12,
                            textAlign: "center",
                          }}
                        >
                          →
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--s3)" }}>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono',monospace",
                              fontSize: 12,
                              color: "var(--ac-t)",
                              background: "var(--ac-s)",
                              padding: "2px 8px",
                              borderRadius: 6,
                              display: "inline-block",
                            }}
                          >
                            {m.external}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            borderBottom: "1px solid var(--s3)",
                            fontSize: 13,
                          }}
                        >
                          {m.invoices}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            borderBottom: "1px solid var(--s3)",
                            fontSize: 12,
                            color: "var(--t3)",
                          }}
                        >
                          {m.lastSync}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--s3)" }}>
                          <Pill tone="ok">Synced</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {detailTab === "sync activity" && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <div>
                  <h3
                    style={{
                      fontFamily: "'DM Sans',system-ui,sans-serif",
                      fontSize: 15,
                      fontWeight: 720,
                      letterSpacing: "-.01em",
                      margin: 0,
                    }}
                  >
                    Recent sync activity
                  </h3>
                  <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2, fontWeight: 520 }}>
                    Last 10 sync operations
                  </div>
                </div>
                <button style={btnGhostSm()}>View all</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {SYNC_LOG.map((s, i) => {
                  const iconMap = {
                    push: { bg: "var(--ac-s)", color: "var(--ac-t)", node: I.arrowUp },
                    pull: { bg: "var(--in-s)", color: "var(--in-t)", node: I.arrowDown },
                    reconcile: { bg: "var(--ok-s)", color: "var(--ok-t)", node: I.check },
                  } as const;
                  const ic = iconMap[s.icon];
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "10px 12px",
                        border: "1px solid var(--s3)",
                        borderRadius: 10,
                        background: "var(--s1)",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                          background: ic.bg,
                          color: ic.color,
                        }}
                      >
                        {ic.node}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: "'DM Sans',system-ui,sans-serif",
                            fontSize: 13,
                            fontWeight: 650,
                          }}
                        >
                          {s.title}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--t2)",
                            lineHeight: 1.45,
                            marginTop: 2,
                            fontWeight: 520,
                          }}
                        >
                          {s.desc}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--t3)",
                            fontFamily: "'DM Sans',system-ui,sans-serif",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.time}
                        </span>
                        <Pill tone={s.status === "success" ? "ok" : "danger"}>
                          {s.status === "success" ? "Success" : "Failed"}
                        </Pill>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {detailTab === "settings" && (
            <div
              style={{
                padding: "24px 4px",
                color: "var(--t2)",
                fontSize: 13,
                fontWeight: 520,
                textAlign: "center",
              }}
            >
              Per-integration settings (sync frequency, default accounts, error alerts) will appear
              here.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function IntegrationCard({ int }: { int: Integration }) {
  const isConnected = int.state === "connected";
  const logoStyles: Record<Integration["logoCls"], CSSProperties> = {
    qb: {
      background: "linear-gradient(135deg,#2ca01c,#108a00)",
      color: "white",
      fontFamily: "'DM Sans',system-ui,sans-serif",
      fontSize: 16,
      fontWeight: 800,
      border: "none",
    },
    stripe: {
      background: "linear-gradient(135deg,#635bff,#4f46d6)",
      color: "white",
      fontFamily: "'DM Sans',system-ui,sans-serif",
      fontSize: 14,
      fontWeight: 800,
      border: "none",
    },
    xero: {
      background: "linear-gradient(135deg,#13b5ea,#0d9dd5)",
      color: "white",
      fontFamily: "'DM Sans',system-ui,sans-serif",
      fontSize: 13,
      fontWeight: 800,
      border: "none",
    },
    sage: {
      background: "linear-gradient(135deg,#00d639,#00b62f)",
      color: "white",
      fontFamily: "'DM Sans',system-ui,sans-serif",
      fontSize: 13,
      fontWeight: 800,
      border: "none",
    },
    gcal: { background: "var(--s1)", fontSize: 22 },
    email: {
      background: "linear-gradient(135deg,#f59e0b,#d97706)",
      color: "white",
      border: "none",
    },
    csv: { background: "var(--s2)", color: "var(--t2)" },
    webhook: {
      background: "linear-gradient(135deg,#6366f1,#4f46e5)",
      color: "white",
      border: "none",
    },
  };
  const logoNode =
    int.logo === "file" ? I.file : int.logo === "link" ? I.link : int.logo;

  return (
    <div
      style={{
        background: "var(--s1)",
        border: `1px solid ${isConnected && !int.alwaysOn ? "var(--ac-m)" : "var(--s3)"}`,
        borderRadius: 18,
        padding: 20,
        position: "relative",
        overflow: "hidden",
        transition: "all 200ms",
      }}
    >
      {isConnected && !int.alwaysOn && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg,var(--ac),var(--ac-m))",
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            border: "1px solid var(--s3)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            fontSize: 20,
            background: "var(--s2)",
            ...logoStyles[int.logoCls],
          }}
        >
          {logoNode}
        </div>
        <div>
          <div
            style={{
              fontFamily: "'DM Sans',system-ui,sans-serif",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-.01em",
            }}
          >
            {int.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2, fontWeight: 520 }}>
            {int.provider}
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--t2)",
          lineHeight: 1.5,
          marginBottom: 14,
          fontWeight: 520,
        }}
      >
        {int.desc}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            flexShrink: 0,
            background: isConnected ? "var(--ok)" : "var(--s4)",
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 620,
            color: isConnected ? "var(--ok-t)" : "var(--t3)",
          }}
        >
          {int.statusLabel}
        </span>
        {int.statusMeta && (
          <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: "auto" }}>
            {int.statusMeta}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {int.pills?.map((p, i) => (
          <Pill key={i} tone={p.tone}>
            {p.text}
          </Pill>
        ))}
        {int.btn && (
          <button
            style={{
              height: 30,
              padding: "0 10px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 620,
              background: "var(--ac)",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontFamily: "'Instrument Sans',system-ui,sans-serif",
            }}
          >
            {int.btn}
          </button>
        )}
        {int.gated && (
          <button
            style={{
              height: 30,
              padding: "0 10px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 620,
              color: "var(--ac-t)",
              background: "transparent",
              border: "1px solid var(--s3)",
              cursor: "pointer",
              fontFamily: "'Instrument Sans',system-ui,sans-serif",
            }}
          >
            Upgrade plan
          </button>
        )}
        {int.extraPill && <Pill tone={int.extraPill.tone}>{int.extraPill.text}</Pill>}
      </div>
    </div>
  );
}

// ═══════ CONTRACTOR: PAYMENTS TAB ══════════════════════════════════════
type PaymentRow = {
  icon: "ach" | "card" | "pending";
  emoji: string;
  title: string;
  meta: string;
  amount: string;
  fee: string;
  status: string;
  statusTone?: PillTone;
};
const RECENT_PAYMENTS: PaymentRow[] = [
  { icon: "ach", emoji: "\u{1F3E6}", title: "Draw #5 — Riverside Tower Fit-Out", meta: "ACH · TD Bank ****6789 · Riverside Holdings LLC · Apr 13", amount: "$45,100.00", fee: "Fee: $5.00 · Net: $45,095.00", status: "Processing", statusTone: "warn" },
  { icon: "ach", emoji: "\u{1F3E6}", title: "Draw #4 — Riverside Tower Fit-Out", meta: "ACH · TD Bank ****6789 · Riverside Holdings LLC · Apr 8", amount: "$38,200.00", fee: "Fee: $5.00 · Net: $38,195.00", status: "Succeeded", statusTone: "ok" },
  { icon: "card", emoji: "\u{1F4B3}", title: "Selection upgrade — 14 Maple Lane", meta: "Visa ****4242 · Sarah Chen · Apr 6", amount: "$2,400.00", fee: "Fee: $69.90 · Net: $2,330.10", status: "Succeeded", statusTone: "ok" },
  { icon: "ach", emoji: "\u{1F3E6}", title: "Draw #3 — 14 Maple Lane Renovation", meta: "ACH · RBC ****2341 · Sarah & James Chen · Apr 3", amount: "$22,750.00", fee: "Fee: $5.00 · Net: $22,745.00", status: "Succeeded", statusTone: "ok" },
  { icon: "ach", emoji: "\u{1F3E6}", title: "Draw #6 — King St Office Build-Out", meta: "ACH · CIBC ****8870 · Apex Ventures Inc · Mar 29", amount: "$67,200.00", fee: "Fee: $5.00 · Net: $67,195.00", status: "Succeeded", statusTone: "ok" },
  { icon: "pending", emoji: "\u{1F4DD}", title: "Draw #2 — Harbour View Condo (manual)", meta: "Check #4891 · R. Thompson · Mar 24", amount: "$18,900.00", fee: "Fee: — · Recorded manually", status: "Manual" },
];

function ContractorPaymentsTab({
  contractor,
}: {
  contractor?: ContractorSettingsBundle;
}) {
  if (contractor?.payments) {
    return (
      <PaymentsView view={contractor.payments} nowMs={contractor.nowMs} />
    );
  }
  return <ContractorPaymentsSampleTab />;
}

function ContractorPaymentsSampleTab() {
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <h2
          style={{
            fontFamily: "'DM Sans',system-ui,sans-serif",
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-.03em",
            margin: 0,
          }}
        >
          Payments
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--t2)",
            marginTop: 4,
            maxWidth: 640,
            fontWeight: 520,
            marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          Manage your Stripe Connect account, view processed payments, and configure payment
          preferences.
        </p>
      </div>

      <div
        className="payments-hero"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <style>{`@media (max-width: 880px) { .payments-hero { grid-template-columns: 1fr !important; } }`}</style>

        <div
          style={{
            background: "var(--s1)",
            border: "1px solid var(--s3)",
            borderRadius: 18,
            padding: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "linear-gradient(135deg,#635bff,#4f46d6)",
                color: "white",
                display: "grid",
                placeItems: "center",
                fontFamily: "'DM Sans',system-ui,sans-serif",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              S
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  fontSize: 15,
                  fontWeight: 720,
                  letterSpacing: "-.01em",
                }}
              >
                Stripe Connect
              </div>
              <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2, fontWeight: 520 }}>
                Account:{" "}
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                  acct_1PqR3sT4uV
                </span>{" "}
                · Verified
              </div>
            </div>
            <Pill tone="ok">Active</Pill>
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { label: "Total processed", value: "$287,000", meta: "14 payments across 4 projects" },
              { label: "Processing fees", value: "$64", meta: "Avg 0.02% · ACH cap at $5/txn" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  flex: 1,
                  minWidth: 160,
                  background: "var(--s2)",
                  border: "1px solid var(--s3)",
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                    color: "var(--t3)",
                    fontWeight: 700,
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    fontSize: 20,
                    fontWeight: 820,
                    letterSpacing: "-.03em",
                    marginTop: 4,
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: 11, color: "var(--t2)", marginTop: 3, fontWeight: 520 }}>
                  {s.meta}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btnGhostSm()}>Stripe dashboard</button>
            <button style={btnGhostSm()}>Payout settings</button>
            <button style={btnDangerSm()}>Disconnect</button>
          </div>
        </div>

        <div
          style={{
            background: "var(--s1)",
            border: "1px solid var(--s3)",
            borderRadius: 18,
            padding: 20,
          }}
        >
          <h4
            style={{
              fontFamily: "'DM Sans',system-ui,sans-serif",
              fontSize: 14,
              fontWeight: 720,
              margin: 0,
            }}
          >
            Payment methods enabled
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {[
              { emoji: "\u{1F3E6}", name: "ACH Bank Transfer", desc: "0.8% fee, capped at $5 per transaction", pill: "Enabled", tone: "ok" as PillTone, bg: "var(--ok-s)" },
              { emoji: "\u{1F4B3}", name: "Credit / Debit Card", desc: "2.9% + $0.30 per transaction", pill: "Enabled", tone: "ok" as PillTone, bg: "var(--in-s)" },
              { emoji: "\u270F\uFE0F", name: "Manual recording", desc: "Record checks, wires, and other offline payments for tracking", pill: "Always on", tone: undefined as PillTone | undefined, bg: "var(--s2)" },
            ].map((m) => (
              <div
                key={m.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  background: "var(--s2)",
                  border: "1px solid var(--s3)",
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: m.bg,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {m.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "'DM Sans',system-ui,sans-serif",
                      fontSize: 13,
                      fontWeight: 650,
                    }}
                  >
                    {m.name}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "var(--t2)", marginTop: 1, fontWeight: 520 }}
                  >
                    {m.desc}
                  </div>
                </div>
                <Pill tone={m.tone}>{m.pill}</Pill>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: "'DM Sans',system-ui,sans-serif",
              fontSize: 15,
              fontWeight: 720,
              letterSpacing: "-.01em",
              margin: 0,
            }}
          >
            Recent payments
          </h3>
          <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2, fontWeight: 520 }}>
            All payment transactions across projects
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnGhostSm()}>Export</button>
          <button style={btnGhostSm()}>Record manual payment</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {RECENT_PAYMENTS.map((p, i) => {
          const iconBg =
            p.icon === "ach" ? "var(--ok-s)" : p.icon === "card" ? "var(--in-s)" : "var(--wr-s)";
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                border: "1px solid var(--s3)",
                borderRadius: 10,
                background: "var(--s1)",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  fontSize: 14,
                  background: iconBg,
                }}
              >
                {p.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div
                  style={{
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    fontSize: 13,
                    fontWeight: 650,
                  }}
                >
                  {p.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--t2)", fontWeight: 520 }}>{p.meta}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    fontSize: 15,
                    fontWeight: 750,
                    letterSpacing: "-.02em",
                  }}
                >
                  {p.amount}
                </div>
                <div
                  style={{ fontSize: 11, color: "var(--t3)", fontWeight: 520, marginTop: 2 }}
                >
                  {p.fee}
                </div>
              </div>
              <Pill tone={p.statusTone}>{p.status}</Pill>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ═══════ Shared contractor-tab primitives ══════════════════════════════
type PillTone = "ok" | "warn" | "danger" | "accent" | "info";
function Pill({ children, tone }: { children: ReactNode; tone?: PillTone }) {
  const map: Record<PillTone, { bg: string; color: string; border: string }> = {
    ok: { bg: "var(--ok-s)", color: "var(--ok-t)", border: "var(--ok)" },
    warn: { bg: "var(--wr-s)", color: "var(--wr-t)", border: "var(--wr)" },
    danger: { bg: "var(--dg-s)", color: "var(--dg-t)", border: "var(--dg)" },
    accent: { bg: "var(--ac-s)", color: "var(--ac-t)", border: "var(--ac-m)" },
    info: { bg: "var(--in-s)", color: "var(--in-t)", border: "var(--in)" },
  };
  const style = tone
    ? map[tone]
    : { bg: "var(--s1)", color: "var(--t3)", border: "var(--s3)" };
  return (
    <span
      style={{
        height: 22,
        padding: "0 10px",
        borderRadius: 999,
        border: `1px solid ${style.border}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 700,
        background: style.bg,
        color: style.color,
        whiteSpace: "nowrap",
        flexShrink: 0,
        fontFamily: "'DM Sans',system-ui,sans-serif",
        letterSpacing: ".02em",
      }}
    >
      {children}
    </span>
  );
}

function SegmentedTabs({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; badge?: number }>;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        background: "var(--s2)",
        borderRadius: 14,
        padding: 4,
        width: "fit-content",
        flexWrap: "wrap",
      }}
    >
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: on ? 650 : 620,
              color: on ? "var(--t1)" : "var(--t2)",
              background: on ? "var(--s1)" : "transparent",
              boxShadow: on ? "var(--shsm)" : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "'Instrument Sans',system-ui,sans-serif",
            }}
          >
            {o.label}
            {o.badge != null && o.badge > 0 && (
              <span
                style={{
                  minWidth: 16,
                  height: 16,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: "var(--ac-s)",
                  color: "var(--ac-t)",
                  fontSize: 9,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                }}
              >
                {o.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ═══════ CONTRACTOR: ORGANIZATION TAB ══════════════════════════════════
type OrgForm = {
  legalName: string;
  displayName: string;
  ein: string;
  website: string;
  phone: string;
  addr1: string;
  addr2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  primaryContact: string;
  billingContact: string;
  billingEmail: string;
};
type OrgLicense = { id: number; kind: string; number: string; state: string; expires: string };
const ORG_DEFAULTS: OrgForm = {
  legalName: "Summit Contracting LLC",
  displayName: "Summit Contracting",
  ein: "87-4521983",
  website: "https://summitcontracting.com",
  phone: "+1 (415) 555-0100",
  addr1: "1240 Industrial Blvd",
  addr2: "Suite 300",
  city: "San Francisco",
  state: "CA",
  zip: "94103",
  country: "United States",
  primaryContact: "Dan Carter",
  billingContact: "Rachel Owens",
  billingEmail: "billing@summitcontracting.com",
};
const ORG_LICENSES: OrgLicense[] = [
  { id: 1, kind: "General Contractor (CSLB)", number: "B-1089432", state: "CA", expires: "2027-03-15" },
  { id: 2, kind: "RBQ (Quebec)", number: "5812-9947-01", state: "QC", expires: "2026-11-30" },
];

function ContractorOrganizationTab({
  contractor,
}: {
  contractor?: ContractorSettingsBundle;
}) {
  if (contractor?.orgProfile) {
    return <ContractorOrganizationLiveTab contractor={contractor} />;
  }
  return <ContractorOrganizationSampleTab />;
}

function ContractorOrganizationSampleTab() {
  const [org, setOrg] = useState<OrgForm>(ORG_DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const update = <K extends keyof OrgForm>(k: K, v: OrgForm[K]) => {
    setOrg((p) => ({ ...p, [k]: v }));
    setDirty(true);
    setSaved(false);
  };
  const save = () => {
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  };
  const discard = () => {
    setOrg(ORG_DEFAULTS);
    setDirty(false);
  };
  const initials = org.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      <Panel title="Company logo" subtitle="Shown in the sidebar, on client-facing documents, and on invoices.">
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 14,
              background: "linear-gradient(135deg,var(--ac),var(--ac-m))",
              color: "white",
              display: "grid",
              placeItems: "center",
              fontFamily: "'DM Sans',system-ui,sans-serif",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: "-.04em",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 8, fontWeight: 500 }}>
              PNG or SVG · square, up to 2 MB · 512×512 recommended
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={btnGhostSm()}>
                <span style={{ marginRight: 6 }}>{I.upload}</span>Upload logo
              </button>
              <button style={btnGhostSm()}>Remove</button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Company information" subtitle="How your organization appears across the app and on official documents.">
        <FieldRow>
          <Field label="Display name" help="Shown in the app and to your team">
            <input style={fieldStyle()} value={org.displayName} onChange={(e) => update("displayName", e.target.value)} />
          </Field>
          <Field label="Legal name" help="Used on invoices, W-9s, and contracts">
            <input style={fieldStyle()} value={org.legalName} onChange={(e) => update("legalName", e.target.value)} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Tax ID (EIN)">
            <input
              style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".02em" }}
              value={org.ein}
              onChange={(e) => update("ein", e.target.value)}
            />
          </Field>
          <Field label="Website">
            <input type="url" style={fieldStyle()} value={org.website} onChange={(e) => update("website", e.target.value)} />
          </Field>
        </FieldRow>
        <Field label="Main phone">
          <input type="tel" style={fieldStyle()} value={org.phone} onChange={(e) => update("phone", e.target.value)} />
        </Field>
      </Panel>

      <Panel title="Business address" subtitle="Used on invoices, mailing, and tax forms.">
        <Field label="Street address">
          <input style={fieldStyle()} value={org.addr1} onChange={(e) => update("addr1", e.target.value)} />
        </Field>
        <Field label="Suite / unit (optional)">
          <input style={fieldStyle()} value={org.addr2} onChange={(e) => update("addr2", e.target.value)} />
        </Field>
        <div
          className="addr-row"
          style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}
        >
          <style>{`@media (max-width: 620px) { .addr-row { grid-template-columns: 1fr !important; } }`}</style>
          <Field label="City">
            <input style={fieldStyle()} value={org.city} onChange={(e) => update("city", e.target.value)} />
          </Field>
          <Field label="State / province">
            <input style={fieldStyle()} value={org.state} onChange={(e) => update("state", e.target.value)} />
          </Field>
          <Field label="ZIP / postal">
            <input
              style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".02em" }}
              value={org.zip}
              onChange={(e) => update("zip", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Country">
          <select style={fieldStyle()} value={org.country} onChange={(e) => update("country", e.target.value)}>
            <option>United States</option>
            <option>Canada</option>
            <option>Mexico</option>
          </select>
        </Field>
      </Panel>

      <Panel title="Contacts" subtitle="Primary and billing contacts for your organization.">
        <FieldRow>
          <Field label="Primary contact" help="Default point of contact for inbound queries">
            <input style={fieldStyle()} value={org.primaryContact} onChange={(e) => update("primaryContact", e.target.value)} />
          </Field>
          <Field label="Billing contact">
            <input style={fieldStyle()} value={org.billingContact} onChange={(e) => update("billingContact", e.target.value)} />
          </Field>
        </FieldRow>
        <Field label="Billing email" help="Where invoice PDFs and receipts are sent">
          <input type="email" style={fieldStyle()} value={org.billingEmail} onChange={(e) => update("billingEmail", e.target.value)} />
        </Field>
      </Panel>

      <Panel
        title="Licenses & credentials"
        subtitle="Licensing information shown on client-facing documents and used for compliance verification."
        headerRight={
          <button style={btnGhostSm()}>
            <span style={{ marginRight: 4 }}>{I.plus}</span>Add license
          </button>
        }
      >
        {ORG_LICENSES.map((l) => (
          <div
            key={l.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: 14,
              border: "1px solid var(--s3)",
              borderRadius: 14,
              marginBottom: 8,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  fontSize: 13.5,
                  fontWeight: 650,
                  letterSpacing: "-.01em",
                }}
              >
                {l.kind}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--t3)",
                  marginTop: 3,
                  fontWeight: 500,
                  fontFamily: "'JetBrains Mono',monospace",
                }}
              >
                {l.number} · {l.state} · Expires {l.expires}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={btnGhostSm()}>Edit</button>
              <button style={{ ...btnGhostSm(), color: "var(--dg)" }} aria-label="Remove license">
                {I.x}
              </button>
            </div>
          </div>
        ))}
      </Panel>

      {(dirty || saved) && (
        <SaveBar
          state={saved ? "success" : "dirty"}
          message={saved ? "Organization saved" : "You have unsaved changes"}
          showActions={!saved}
          onDiscard={discard}
          onSave={save}
          saving={false}
        />
      )}
    </>
  );
}

// ═══════ CONTRACTOR: TEAM & ROLES TAB ══════════════════════════════════
type RoleDef = { id: string; label: string; desc: string; scope: "org" | "project" };
const TEAM_ROLES: RoleDef[] = [
  { id: "admin", label: "Admin", desc: "Full access to everything including billing and team management.", scope: "org" },
  { id: "pm", label: "Project Manager", desc: "Create and run projects, approve COs and draws, manage subs and clients.", scope: "project" },
  { id: "estimator", label: "Estimator", desc: "Budgets, bids, and scope. Read access to projects they're assigned to.", scope: "project" },
  { id: "field", label: "Field Supervisor", desc: "RFIs, daily field ops, and schedule updates. No billing access.", scope: "project" },
  { id: "finance", label: "Finance", desc: "Billing, draws, lien waivers, and reports. Read-only on project content.", scope: "org" },
  { id: "viewer", label: "Viewer", desc: "Read-only across all assigned projects. No create/edit permissions.", scope: "project" },
];

type TeamMember = {
  id: number;
  name: string;
  email: string;
  avatar: string;
  role: string;
  lastActive: string;
  joined: string;
  you?: boolean;
};
type TeamInvite = { id: number; email: string; role: string; sentBy: string; sent: string };

const MEMBERS_INITIAL: TeamMember[] = [
  { id: 1, name: "Dan Carter", email: "dan.carter@summitcontracting.com", avatar: "DC", role: "admin", lastActive: "Active now", joined: "Jan 2024", you: true },
  { id: 2, name: "Rachel Owens", email: "rachel.owens@summitcontracting.com", avatar: "RO", role: "finance", lastActive: "3 hours ago", joined: "Feb 2024" },
  { id: 3, name: "James Whitfield", email: "james.w@summitcontracting.com", avatar: "JW", role: "pm", lastActive: "1 hour ago", joined: "Mar 2024" },
  { id: 4, name: "Lisa Chen", email: "lisa.chen@summitcontracting.com", avatar: "LC", role: "estimator", lastActive: "Yesterday", joined: "May 2024" },
  { id: 5, name: "Tom Nakamura", email: "tom.n@summitcontracting.com", avatar: "TN", role: "field", lastActive: "2 days ago", joined: "Jul 2024" },
  { id: 6, name: "Marcus Bell", email: "marcus.bell@summitcontracting.com", avatar: "MB", role: "viewer", lastActive: "1 week ago", joined: "Oct 2024" },
];
const INVITES_INITIAL: TeamInvite[] = [
  { id: 101, email: "new.hire@summitcontracting.com", role: "pm", sentBy: "Dan Carter", sent: "2 days ago" },
];

function ContractorTeamRolesTab({
  contractor,
}: {
  contractor?: ContractorSettingsBundle;
}) {
  if (contractor) {
    return <ContractorTeamRolesLiveTab contractor={contractor} />;
  }
  return <ContractorTeamRolesSampleTab />;
}

function ContractorTeamRolesSampleTab() {
  const [members, setMembers] = useState<TeamMember[]>(MEMBERS_INITIAL);
  const [invites, setInvites] = useState<TeamInvite[]>(INVITES_INITIAL);
  const [memberSearch, setMemberSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("pm");
  const [removeConfirm, setRemoveConfirm] = useState<number | null>(null);
  const [roleExplainer, setRoleExplainer] = useState(false);
  const [roleWarning, setRoleWarning] = useState<string | null>(null);

  const changeMemberRole = (id: number, newRole: string) => {
    const adminCount = members.filter((m) => m.role === "admin").length;
    const target = members.find((m) => m.id === id);
    if (target?.you && target.role === "admin" && newRole !== "admin" && adminCount === 1) {
      setRoleWarning("You're the only Admin. Promote someone else before demoting yourself.");
      setTimeout(() => setRoleWarning(null), 3500);
      return;
    }
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: newRole } : m)));
  };
  const sendInvite = () => {
    if (!inviteEmail) return;
    setInvites((prev) => [
      ...prev,
      { id: Date.now(), email: inviteEmail, role: inviteRole, sentBy: "Dan Carter", sent: "Just now" },
    ]);
    setInviteEmail("");
    setInviteRole("pm");
    setShowInvite(false);
  };
  const removeMember = (id: number) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setRemoveConfirm(null);
  };
  const cancelInvite = (id: number) => setInvites((prev) => prev.filter((i) => i.id !== id));
  const filteredMembers = members.filter(
    (m) =>
      !memberSearch ||
      m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearch.toLowerCase()),
  );

  return (
    <>
      <Panel
        title="Roles"
        subtitle="How permissions are organized. Admins can change any member's role; Admin cannot demote themselves if they're the last one."
        headerRight={
          <button style={btnGhostSm()} onClick={() => setRoleExplainer((v) => !v)}>
            {roleExplainer ? "Hide details" : "Show details"}
          </button>
        }
      >
        {roleExplainer && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
              gap: 10,
              marginTop: 4,
            }}
          >
            {TEAM_ROLES.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: "12px 14px",
                  border: "1px solid var(--s3)",
                  borderRadius: 10,
                  background: "var(--s1)",
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    fontSize: 13,
                    fontWeight: 650,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  {r.label}
                  <Pill tone={r.scope === "org" ? "accent" : "info"}>
                    {r.scope === "org" ? "Org-wide" : "Per-project"}
                  </Pill>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--t3)", lineHeight: 1.45, fontWeight: 500 }}>
                  {r.desc}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={`Members (${members.length})`}
        subtitle="Everyone in your organization with access to BuiltCRM. Changes apply on their next request."
        headerRight={
          <button style={btnPrimarySm(true)} onClick={() => setShowInvite((v) => !v)}>
            {showInvite ? "Cancel" : (
              <>
                <span style={{ marginRight: 4 }}>{I.plus}</span>Invite member
              </>
            )}
          </button>
        }
      >
        {showInvite && (
          <div
            style={{
              background: "var(--ac-s)",
              border: "1px solid var(--ac-m)",
              borderRadius: 14,
              padding: 18,
              marginBottom: 12,
              display: "grid",
              gridTemplateColumns: "2fr 1fr auto auto",
              gap: 10,
              alignItems: "end",
            }}
          >
            <style>{`@media (max-width: 760px) { [data-invite-grid] { grid-template-columns: 1fr !important; } }`}</style>
            <Field label="Email address">
              <input
                type="email"
                placeholder="new.member@summitcontracting.com"
                style={fieldStyle()}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </Field>
            <Field label="Role">
              <select style={fieldStyle()} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                {TEAM_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <button style={btnGhostSm()} onClick={() => setShowInvite(false)}>
              Cancel
            </button>
            <button style={btnPrimarySm(Boolean(inviteEmail))} onClick={sendInvite} disabled={!inviteEmail}>
              Send invite
            </button>
          </div>
        )}

        <div style={{ position: "relative", maxWidth: 320, marginBottom: 14 }}>
          <span
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--t3)",
              pointerEvents: "none",
              display: "flex",
            }}
          >
            {I.search}
          </span>
          <input
            placeholder="Search members by name or email..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            style={{ ...fieldStyle(), height: 36, paddingLeft: 34 }}
          />
        </div>

        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                {["Member", "Role", "Last active", ""].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      fontFamily: "'DM Sans',system-ui,sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--t3)",
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                      textAlign: i === 3 ? "right" : "left",
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--s3)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => (
                <tr key={m.id}>
                  <td
                    style={{
                      padding: "14px 12px",
                      borderBottom: "1px solid var(--s2)",
                      fontSize: 13.5,
                      verticalAlign: "middle",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg,var(--ac),var(--ac-m))",
                          color: "white",
                          display: "grid",
                          placeItems: "center",
                          fontFamily: "'DM Sans',system-ui,sans-serif",
                          fontSize: 12,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {m.avatar}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: "'DM Sans',system-ui,sans-serif",
                            fontSize: 13.5,
                            fontWeight: 650,
                            letterSpacing: "-.01em",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {m.name}
                          {m.you && <Pill tone="accent">You</Pill>}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2, fontWeight: 500 }}>
                          {m.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "14px 12px", borderBottom: "1px solid var(--s2)" }}>
                    <select
                      value={m.role}
                      onChange={(e) => changeMemberRole(m.id, e.target.value)}
                      style={{
                        ...fieldStyle(),
                        height: 32,
                        width: "auto",
                        fontSize: 12.5,
                        padding: "0 28px 0 10px",
                      }}
                    >
                      {TEAM_ROLES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    style={{
                      padding: "14px 12px",
                      borderBottom: "1px solid var(--s2)",
                      color: "var(--t2)",
                      fontSize: 12.5,
                    }}
                  >
                    {m.lastActive}
                  </td>
                  <td
                    style={{
                      padding: "14px 12px",
                      borderBottom: "1px solid var(--s2)",
                      textAlign: "right",
                    }}
                  >
                    {!m.you && (
                      <button
                        style={{ ...btnGhostSm(), color: "var(--dg)" }}
                        onClick={() => setRemoveConfirm(m.id)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: "center",
                      padding: 24,
                      color: "var(--t3)",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    No members match &ldquo;{memberSearch}&rdquo;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {roleWarning && (
          <div
            style={{
              background: "var(--wr-s)",
              border: "1px solid var(--wr)",
              borderRadius: 12,
              padding: "10px 14px",
              marginTop: 10,
              fontSize: 12.5,
              color: "var(--wr-t)",
              fontWeight: 580,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {I.warn}
            {roleWarning}
          </div>
        )}

        {removeConfirm && (
          <div
            style={{
              background: "var(--dg-s)",
              border: "1px solid var(--dg)",
              borderRadius: 14,
              padding: 14,
              marginTop: 4,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 12.5,
                color: "var(--dg)",
                fontWeight: 580,
                flex: 1,
                minWidth: 200,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {I.warn}
              Remove{" "}
              <strong>{members.find((m) => m.id === removeConfirm)?.name}</strong> from the
              organization? Their record will be preserved for audit but they&rsquo;ll lose access
              immediately.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={btnGhostSm()} onClick={() => setRemoveConfirm(null)}>
                Cancel
              </button>
              <button style={btnDangerSm()} onClick={() => removeMember(removeConfirm)}>
                Confirm remove
              </button>
            </div>
          </div>
        )}
      </Panel>

      {invites.length > 0 && (
        <Panel
          title={`Pending invites (${invites.length})`}
          subtitle="People who've been invited but haven't accepted yet."
        >
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr>
                  {["Email", "Role", "Sent", ""].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        fontFamily: "'DM Sans',system-ui,sans-serif",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--t3)",
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                        textAlign: i === 3 ? "right" : "left",
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--s3)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id}>
                    <td
                      style={{
                        padding: "14px 12px",
                        borderBottom: "1px solid var(--s2)",
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 12.5,
                      }}
                    >
                      {inv.email}
                    </td>
                    <td style={{ padding: "14px 12px", borderBottom: "1px solid var(--s2)" }}>
                      <Pill>{TEAM_ROLES.find((r) => r.id === inv.role)?.label ?? inv.role}</Pill>
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        borderBottom: "1px solid var(--s2)",
                        color: "var(--t2)",
                        fontSize: 12.5,
                      }}
                    >
                      {inv.sent} · by {inv.sentBy}
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        borderBottom: "1px solid var(--s2)",
                        textAlign: "right",
                      }}
                    >
                      <button style={btnGhostSm()}>Resend</button>
                      <button
                        style={{ ...btnGhostSm(), color: "var(--dg)", marginLeft: 4 }}
                        onClick={() => cancelInvite(inv.id)}
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

// ═══════ CONTRACTOR: PLAN & BILLING TAB ════════════════════════════════
type PlanTier = {
  id: string;
  name: string;
  monthly: number | null;
  annual: number | null;
  blurb: string;
  featured?: boolean;
  limits: { projects: string; team: string; storage: string };
  highlights: string[];
};
const PLANS: PlanTier[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 149,
    annual: 119,
    blurb: "Solo GC or small crew, handful of projects.",
    limits: { projects: "5 active", team: "3 members", storage: "5 GB" },
    highlights: ["AIA billing & draw requests", "RFI & change order tracking", "Client portals"],
  },
  {
    id: "pro",
    name: "Professional",
    monthly: 399,
    annual: 319,
    blurb: "Growing teams with multiple projects.",
    featured: true,
    limits: { projects: "Unlimited", team: "10 members", storage: "50 GB" },
    highlights: [
      "Everything in Starter",
      "Compliance management",
      "Selections studio",
      "Approval workflows",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthly: null,
    annual: null,
    blurb: "Custom workflows, integrations, and dedicated support.",
    limits: { projects: "Unlimited", team: "Unlimited", storage: "Unlimited" },
    highlights: [
      "Custom integrations",
      "SSO / SAML",
      "Dedicated account manager",
      "Custom onboarding",
    ],
  },
];
const CURRENT_PLAN_ID = "pro";
const CURRENT_USAGE = {
  projects: { used: 7, cap: "Unlimited" },
  team: { used: 6, cap: 10 },
  storage: { used: 14.2, cap: 50 },
};

type BillingInvoice = { id: string; date: string; amount: number; status: string; period: string };
const BILLING_INVOICES: BillingInvoice[] = [
  { id: "INV-2026-04-0041", date: "Apr 1, 2026", amount: 319.0, status: "Paid", period: "Apr 2026" },
  { id: "INV-2026-03-0038", date: "Mar 1, 2026", amount: 319.0, status: "Paid", period: "Mar 2026" },
  { id: "INV-2026-02-0035", date: "Feb 1, 2026", amount: 319.0, status: "Paid", period: "Feb 2026" },
  { id: "INV-2026-01-0032", date: "Jan 1, 2026", amount: 319.0, status: "Paid", period: "Jan 2026" },
  { id: "INV-2025-12-0029", date: "Dec 1, 2025", amount: 319.0, status: "Paid", period: "Dec 2025" },
  { id: "INV-2025-11-0026", date: "Nov 1, 2025", amount: 319.0, status: "Paid", period: "Nov 2025" },
];

function ContractorPlanBillingTab() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [showChangePlan, setShowChangePlan] = useState(false);
  const teamPct = (CURRENT_USAGE.team.used / CURRENT_USAGE.team.cap) * 100;
  const storagePct = (CURRENT_USAGE.storage.used / CURRENT_USAGE.storage.cap) * 100;

  return (
    <>
      <Panel
        title="Current plan"
        subtitle="Your subscription and how much of each limit you're using."
        headerRight={
          <button style={btnGhostSm()} onClick={() => setShowChangePlan((v) => !v)}>
            {showChangePlan ? "Hide options" : "Change plan"}
          </button>
        }
      >
        <div
          className="plan-row"
          style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "start" }}
        >
          <style>{`@media (max-width: 820px) { .plan-row { grid-template-columns: 1fr !important; } }`}</style>

          <div
            style={{
              background: "linear-gradient(135deg,var(--ac-s),var(--s1))",
              border: "1px solid var(--ac-m)",
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    fontSize: 22,
                    fontWeight: 780,
                    letterSpacing: "-.03em",
                    color: "var(--ac-t)",
                  }}
                >
                  Professional
                </div>
                <div style={{ fontSize: 13, color: "var(--t2)", fontWeight: 520, marginTop: 2 }}>
                  Annual billing · Renews May 1, 2026
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--t1)",
                  }}
                >
                  $319
                  <small style={{ fontSize: 12, fontWeight: 500, color: "var(--t3)" }}>/mo</small>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--t3)",
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  Billed $3,828/yr
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Pill tone="ok">Active</Pill>
              <Pill tone="accent">Annual · save 20%</Pill>
            </div>
          </div>

          <div>
            <h4
              style={{
                fontFamily: "'DM Sans',system-ui,sans-serif",
                fontSize: 13,
                fontWeight: 700,
                margin: 0,
                marginBottom: 6,
              }}
            >
              Usage this month
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              <UsageBar
                label="Active projects"
                value={`${CURRENT_USAGE.projects.used} / ${CURRENT_USAGE.projects.cap}`}
                pct={28}
              />
              <UsageBar
                label="Team members"
                value={`${CURRENT_USAGE.team.used} / ${CURRENT_USAGE.team.cap}`}
                pct={teamPct}
                tone={teamPct > 75 ? "warn" : "normal"}
              />
              <UsageBar
                label="Document storage"
                value={`${CURRENT_USAGE.storage.used} GB / ${CURRENT_USAGE.storage.cap} GB`}
                pct={storagePct}
              />
            </div>
          </div>
        </div>

        {showChangePlan && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 20,
              borderTop: "1px solid var(--s3)",
              animation: "fadeIn .24s cubic-bezier(.16,1,.3,1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <h4
                style={{
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Compare plans
              </h4>
              <div
                style={{
                  display: "flex",
                  gap: 2,
                  background: "var(--s2)",
                  borderRadius: 10,
                  padding: 3,
                }}
              >
                {(["monthly", "annual"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setBillingCycle(c)}
                    style={{
                      height: 32,
                      padding: "0 14px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 650,
                      color: billingCycle === c ? "var(--t1)" : "var(--t2)",
                      background: billingCycle === c ? "var(--s1)" : "transparent",
                      boxShadow: billingCycle === c ? "var(--shsm)" : "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "'Instrument Sans',system-ui,sans-serif",
                    }}
                  >
                    {c === "monthly" ? "Monthly" : "Annual · save 20%"}
                  </button>
                ))}
              </div>
            </div>
            <div
              className="tier-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}
            >
              <style>{`@media (max-width: 860px) { .tier-grid { grid-template-columns: 1fr !important; } }`}</style>
              {PLANS.map((p) => (
                <PlanTierCard key={p.id} plan={p} billingCycle={billingCycle} isCurrent={p.id === CURRENT_PLAN_ID} />
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="Payment method"
        subtitle="The card we charge for your BuiltCRM subscription. Separate from Stripe Connect which handles your payouts."
        headerRight={<button style={btnGhostSm()}>Update card</button>}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: 14,
            background: "var(--s2)",
            border: "1px solid var(--s3)",
            borderRadius: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 48,
              height: 32,
              borderRadius: 6,
              background: "linear-gradient(135deg,#1a1f71,#0f1551)",
              color: "white",
              display: "grid",
              placeItems: "center",
              fontFamily: "'DM Sans',system-ui,sans-serif",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".05em",
              flexShrink: 0,
            }}
          >
            VISA
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600 }}>
              •••• •••• •••• 4242
            </div>
            <div style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 3, fontWeight: 500 }}>
              Rachel Owens · Expires 08/2028
            </div>
          </div>
          <Pill tone="ok">Default</Pill>
        </div>
      </Panel>

      <Panel
        title="Billing history"
        subtitle="Your past invoices. Click any to download a PDF receipt."
        headerRight={
          <button style={btnGhostSm()}>
            <span style={{ marginRight: 4 }}>{I.download}</span>Export all
          </button>
        }
      >
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
            <thead>
              <tr>
                {["Invoice", "Period", "Date", "Amount", "Status", ""].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      fontFamily: "'DM Sans',system-ui,sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--t3)",
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                      textAlign: i === 5 ? "right" : "left",
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--s3)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BILLING_INVOICES.map((inv) => (
                <tr key={inv.id}>
                  <td
                    style={{
                      padding: "14px 12px",
                      borderBottom: "1px solid var(--s2)",
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 12.5,
                    }}
                  >
                    {inv.id}
                  </td>
                  <td
                    style={{
                      padding: "14px 12px",
                      borderBottom: "1px solid var(--s2)",
                      color: "var(--t2)",
                      fontSize: 12.5,
                    }}
                  >
                    {inv.period}
                  </td>
                  <td
                    style={{
                      padding: "14px 12px",
                      borderBottom: "1px solid var(--s2)",
                      color: "var(--t2)",
                      fontSize: 12.5,
                    }}
                  >
                    {inv.date}
                  </td>
                  <td
                    style={{
                      padding: "14px 12px",
                      borderBottom: "1px solid var(--s2)",
                      fontFamily: "'JetBrains Mono',monospace",
                      fontWeight: 600,
                    }}
                  >
                    ${inv.amount.toFixed(2)}
                  </td>
                  <td style={{ padding: "14px 12px", borderBottom: "1px solid var(--s2)" }}>
                    <Pill tone="ok">{inv.status}</Pill>
                  </td>
                  <td
                    style={{
                      padding: "14px 12px",
                      borderBottom: "1px solid var(--s2)",
                      textAlign: "right",
                    }}
                  >
                    <button style={btnGhostSm()} aria-label={`Download ${inv.id}`}>
                      {I.download}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function UsageBar({
  label,
  value,
  pct,
  tone = "normal",
}: {
  label: string;
  value: string;
  pct: number;
  tone?: "normal" | "warn" | "danger";
}) {
  const fillColor =
    tone === "danger" ? "var(--dg)" : tone === "warn" ? "var(--wr)" : "var(--ac)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span>{label}</span>
        <span
          style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 12,
            color: "var(--t2)",
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "var(--s3)",
          borderRadius: 999,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(pct, 100)}%`,
            background: fillColor,
            borderRadius: 999,
            transition: "width 200ms cubic-bezier(.16,1,.3,1)",
          }}
        />
      </div>
    </div>
  );
}

function PlanTierCard({
  plan,
  billingCycle,
  isCurrent,
}: {
  plan: PlanTier;
  billingCycle: "monthly" | "annual";
  isCurrent: boolean;
}) {
  const price = billingCycle === "annual" ? plan.annual : plan.monthly;
  return (
    <div
      style={{
        background: isCurrent ? "var(--ok-s)" : "var(--s1)",
        border: `1.5px solid ${isCurrent ? "var(--ok)" : plan.featured ? "var(--ac)" : "var(--s3)"}`,
        borderRadius: 14,
        padding: 18,
        position: "relative",
      }}
    >
      {plan.featured && !isCurrent && (
        <div
          style={{
            position: "absolute",
            top: -10,
            right: 14,
            padding: "3px 10px",
            borderRadius: 999,
            fontFamily: "'DM Sans',system-ui,sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".03em",
            textTransform: "uppercase",
            background: "var(--ac)",
            color: "white",
          }}
        >
          Popular
        </div>
      )}
      {isCurrent && (
        <div
          style={{
            position: "absolute",
            top: -10,
            right: 14,
            padding: "3px 10px",
            borderRadius: 999,
            fontFamily: "'DM Sans',system-ui,sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".03em",
            textTransform: "uppercase",
            background: "var(--ok)",
            color: "white",
          }}
        >
          Current
        </div>
      )}
      <div
        style={{
          fontFamily: "'DM Sans',system-ui,sans-serif",
          fontSize: 17,
          fontWeight: 750,
          letterSpacing: "-.02em",
        }}
      >
        {plan.name}
      </div>
      <div
        style={{
          fontFamily: "'DM Sans',system-ui,sans-serif",
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-.03em",
          margin: "6px 0 4px",
          color: "var(--t1)",
        }}
      >
        {price == null ? (
          "Custom"
        ) : (
          <>
            ${price}
            <small style={{ fontSize: 12, fontWeight: 500, color: "var(--t3)" }}>/mo</small>
          </>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 12, lineHeight: 1.4, fontWeight: 520 }}>
        {plan.blurb}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginBottom: 14,
          padding: "10px 12px",
          background: "var(--s2)",
          borderRadius: 10,
        }}
      >
        {(
          [
            ["Projects", plan.limits.projects],
            ["Team", plan.limits.team],
            ["Storage", plan.limits.storage],
          ] as const
        ).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
            <span style={{ color: "var(--t3)", fontWeight: 500 }}>{k}</span>
            <span
              style={{
                color: "var(--t1)",
                fontWeight: 650,
                fontFamily: "'DM Sans',system-ui,sans-serif",
              }}
            >
              {v}
            </span>
          </div>
        ))}
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 14px",
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        {plan.highlights.map((h) => (
          <li
            key={h}
            style={{
              fontSize: 12,
              color: "var(--t2)",
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
              lineHeight: 1.4,
            }}
          >
            <span style={{ color: "var(--ok)", flexShrink: 0, marginTop: 2 }}>{I.check}</span>
            {h}
          </li>
        ))}
      </ul>
      {isCurrent ? (
        <button style={{ ...btnGhostSm(), width: "100%", cursor: "not-allowed", opacity: 0.7 }} disabled>
          Current plan
        </button>
      ) : (
        <button
          style={{
            ...(plan.featured ? btnPrimarySm(true) : btnGhostSm()),
            width: "100%",
          }}
        >
          {plan.id === "enterprise" ? "Contact sales" : plan.id === "starter" ? "Downgrade" : "Upgrade"}
        </button>
      )}
    </div>
  );
}

// ═══════ CONTRACTOR: DATA TAB ══════════════════════════════════════════
function ContractorDataTab() {
  const [exportStatus, setExportStatus] = useState<null | "preparing" | "ready">(null);
  const requestExport = () => {
    setExportStatus("preparing");
    setTimeout(() => setExportStatus("ready"), 2000);
  };

  return (
    <>
      <Panel
        title="Export your data"
        subtitle="Download your data in portable formats. Exports are scoped to your organization and respect authorization — you'll only export what you have access to read."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
            gap: 12,
          }}
        >
          <DataCard
            iconBg="var(--ac-s)"
            iconColor="var(--ac-t)"
            icon={I.download}
            title="Complete archive"
            desc="Everything — projects, documents, messages, billing records, audit log. Delivered as a zipped JSON bundle."
            primary
            action={
              exportStatus === "preparing"
                ? "Preparing..."
                : exportStatus === "ready"
                  ? "Ready — download"
                  : "Request export"
            }
            disabled={exportStatus === "preparing"}
            onAction={requestExport}
            footer={
              exportStatus === "ready"
                ? "Link emailed to your billing address."
                : undefined
            }
          />
          <DataCard
            iconBg="var(--ac-s)"
            iconColor="var(--ac-t)"
            icon={I.file}
            title="Projects (CSV)"
            desc="Project list with statuses, budgets, and team assignments. Good for spreadsheets and reports."
            action={
              <>
                <span style={{ marginRight: 4 }}>{I.download}</span>Download CSV
              </>
            }
          />
          <DataCard
            iconBg="var(--ac-s)"
            iconColor="var(--ac-t)"
            icon={I.file}
            title="Financial records (CSV)"
            desc="SOVs, draws, invoices, lien waivers, and payment history. Feeds straight into accounting."
            action={
              <>
                <span style={{ marginRight: 4 }}>{I.download}</span>Download CSV
              </>
            }
          />
          <DataCard
            iconBg="var(--ac-s)"
            iconColor="var(--ac-t)"
            icon={I.file}
            title="Documents (ZIP)"
            desc="All files uploaded to your projects, with folder structure preserved. Large — may take a few minutes."
            action={
              <>
                <span style={{ marginRight: 4 }}>{I.download}</span>Request ZIP
              </>
            }
          />
        </div>
      </Panel>

      <Panel title="Import projects" subtitle="Bring in data from your previous PM tool or a spreadsheet.">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
            gap: 12,
          }}
        >
          <DataCard
            iconBg="var(--ok-s)"
            iconColor="var(--ok-t)"
            icon={I.upload}
            title="CSV / spreadsheet"
            desc="Map your columns to BuiltCRM fields. Good for project lists, client contacts, and sub directories."
            action="Start import"
          />
          <DataCard
            iconBg="var(--in-s)"
            iconColor="var(--in-t)"
            icon={I.building}
            title="Procore"
            desc="One-time import of projects, documents, and RFIs. OAuth connect, then choose what comes over."
            action="Connect Procore"
          />
          <DataCard
            iconBg="var(--wr-s)"
            iconColor="var(--wr-t)"
            icon={I.building}
            title="Buildertrend"
            desc="Residential-focused import including selections, change orders, and client records."
            action="Connect Buildertrend"
          />
        </div>
      </Panel>

      <Panel
        title="Assisted migration"
        subtitle="For larger moves, our team can do a hands-on migration from any legacy system."
        headerRight={<Pill tone="accent">Enterprise</Pill>}
      >
        <div
          style={{
            background: "var(--s2)",
            border: "1px solid var(--s3)",
            borderRadius: 14,
            padding: 18,
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--s1)",
              color: "var(--ac)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            {I.database}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontSize: 14, fontWeight: 650 }}>
              Talk to our migration team
            </div>
            <div style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 4, lineHeight: 1.45, fontWeight: 520 }}>
              We&rsquo;ll scope your move, build mapping rules together, and run the import end-to-end.
              Typical project: 2–4 weeks.
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={btnPrimarySm(true)}>Schedule a call</button>
              <button style={btnGhostSm()}>View sample plan</button>
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
}

function DataCard({
  iconBg,
  iconColor,
  icon,
  title,
  desc,
  action,
  primary,
  disabled,
  onAction,
  footer,
}: {
  iconBg: string;
  iconColor: string;
  icon: ReactNode;
  title: string;
  desc: string;
  action: ReactNode;
  primary?: boolean;
  disabled?: boolean;
  onAction?: () => void;
  footer?: string;
}) {
  return (
    <div
      style={{
        padding: 18,
        border: "1px solid var(--s3)",
        borderRadius: 14,
        background: "var(--s1)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: iconBg,
          color: iconColor,
          display: "grid",
          placeItems: "center",
          marginBottom: 10,
        }}
      >
        {icon}
      </div>
      <h4
        style={{
          fontFamily: "'DM Sans',system-ui,sans-serif",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "-.01em",
          margin: 0,
          marginBottom: 4,
        }}
      >
        {title}
      </h4>
      <p
        style={{
          fontSize: 12,
          color: "var(--t2)",
          fontWeight: 500,
          lineHeight: 1.45,
          margin: 0,
          marginBottom: 12,
        }}
      >
        {desc}
      </p>
      <button
        style={{
          ...(primary ? btnPrimarySm(!disabled) : btnGhostSm()),
          width: "100%",
        }}
        disabled={disabled}
        onClick={onAction}
      >
        {action}
      </button>
      {footer && (
        <div style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 8, fontWeight: 500 }}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ═══════ CONTRACTOR: ORG SECURITY TAB ══════════════════════════════════
const AUDIT_EVENT_TYPES = [
  "All events",
  "Authentication",
  "Team",
  "Permissions",
  "Billing",
  "Projects",
  "Compliance",
  "Integrations",
];

type AuditEvent = {
  time: string;
  actor: string;
  category: string;
  event: string;
  detail: string;
  ip: string;
};
const AUDIT_EVENTS: AuditEvent[] = [
  { time: "Apr 17, 2026 · 9:42 AM", actor: "Dan Carter", category: "Team", event: "membership.role_changed", detail: "Lisa Chen · Estimator → PM", ip: "73.158.**.**" },
  { time: "Apr 17, 2026 · 8:14 AM", actor: "Rachel Owens", category: "Billing", event: "payment_method.updated", detail: "Card ending 4242 → ending 8391", ip: "172.58.**.**" },
  { time: "Apr 16, 2026 · 4:28 PM", actor: "Dan Carter", category: "Integrations", event: "integration.connected", detail: "QuickBooks Online · OAuth grant", ip: "73.158.**.**" },
  { time: "Apr 16, 2026 · 11:07 AM", actor: "James Whitfield", category: "Projects", event: "project.created", detail: "Northshore Community Center", ip: "67.164.**.**" },
  { time: "Apr 15, 2026 · 3:51 PM", actor: "Dan Carter", category: "Team", event: "membership.invited", detail: "new.hire@summitcontracting.com · PM", ip: "73.158.**.**" },
  { time: "Apr 15, 2026 · 10:19 AM", actor: "Marcus Bell", category: "Authentication", event: "user.signed_in", detail: "Chrome 136 · macOS", ip: "104.132.**.**" },
  { time: "Apr 14, 2026 · 5:44 PM", actor: "Dan Carter", category: "Permissions", event: "role.permissions_updated", detail: "Viewer · Enabled read access to Draws", ip: "73.158.**.**" },
  { time: "Apr 14, 2026 · 2:11 PM", actor: "Rachel Owens", category: "Billing", event: "invoice.downloaded", detail: "INV-2026-04-0041", ip: "172.58.**.**" },
  { time: "Apr 13, 2026 · 1:02 PM", actor: "Tom Nakamura", category: "Compliance", event: "compliance_doc.uploaded", detail: "COI — Meridian MEP · Expires Dec 2026", ip: "67.164.**.**" },
];

function ContractorOrgSecurityTab({
  contractor,
}: {
  contractor?: ContractorSettingsBundle;
}) {
  const router = useRouter();
  const profile = contractor?.orgProfile ?? null;
  const canManage = contractor ? contractor.role === "contractor_admin" : true;

  // Seed state from the loaded profile when present. Default session timeout
  // is 7 days (10080 min) to match the dropdown's "(default)" option label.
  const initialDomains = profile?.allowedEmailDomains ?? null;
  const initialDomainLock = Boolean(initialDomains && initialDomains.length > 0);
  const initialSessionTimeout = String(profile?.sessionTimeoutMinutes ?? 10080);

  const [domainLock, setDomainLock] = useState(initialDomainLock);
  const [sessionTimeout, setSessionTimeout] = useState(initialSessionTimeout);
  const [auditFilter, setAuditFilter] = useState<string>("All events");
  const [auditActor, setAuditActor] = useState("");
  const [ssoDrawerOpen, setSsoDrawerOpen] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySavedAt, setSecuritySavedAt] = useState<number | null>(null);
  const [securitySaving, setSecuritySaving] = useState(false);
  const ssoEnabled = false;

  // Derive the domain to display in the lock description. Prefer the already-
  // configured allowed list; else fall back to the admin's email domain;
  // else the marketing sample domain for the static path.
  const adminEmail = profile?.primaryContactEmail ?? profile?.billingEmail ?? null;
  const adminDomain = adminEmail?.split("@")[1]?.toLowerCase() ?? null;
  const displayDomains =
    initialDomains && initialDomains.length > 0
      ? initialDomains
      : adminDomain
        ? [adminDomain]
        : ["summitcontracting.com"];

  async function saveSecurity(
    updates: {
      allowedEmailDomains?: string[] | null;
      sessionTimeoutMinutes?: number | null;
    },
    optimisticRevert: () => void,
  ) {
    if (!contractor) return; // sample mode: state-only toggle, no persist
    setSecuritySaving(true);
    setSecurityError(null);
    try {
      const res = await fetch("/api/org/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSecurityError(body.message ?? body.error ?? "save_failed");
        optimisticRevert();
        return;
      }
      setSecuritySavedAt(Date.now());
      router.refresh();
      setTimeout(() => setSecuritySavedAt(null), 2400);
    } finally {
      setSecuritySaving(false);
    }
  }

  function toggleDomainLock() {
    const next = !domainLock;
    setDomainLock(next);
    const domains = next
      ? adminDomain
        ? [adminDomain]
        : displayDomains
      : [];
    saveSecurity({ allowedEmailDomains: domains }, () => setDomainLock(!next));
  }
  function updateSessionTimeout(minutes: string) {
    const prev = sessionTimeout;
    setSessionTimeout(minutes);
    const numeric = Number(minutes);
    saveSecurity(
      { sessionTimeoutMinutes: Number.isFinite(numeric) ? numeric : null },
      () => setSessionTimeout(prev),
    );
  }

  // When we have a contractor bundle, render live audit events mapped to the
  // same { time, actor, category, event, detail } shape the UI consumes. The
  // sample path stays on AUDIT_EVENTS until a portal lands without a bundle
  // (never in practice, but keeps the component reusable).
  const sampleAudit = AUDIT_EVENTS;
  const liveAudit = contractor?.auditEvents ?? null;
  const combinedAudit = liveAudit
    ? liveAudit.map((e) => ({
        time: formatAuditTime(e.createdAt),
        actor: e.actor.name,
        category: e.eventCategory,
        event: `${e.objectType}.${e.actionName}`,
        detail: e.detail,
        ip: "—",
      }))
    : sampleAudit;
  const categories = liveAudit ? AUDIT_CATEGORIES : AUDIT_EVENT_TYPES;

  const filteredAudit = combinedAudit.filter((e) => {
    if (auditFilter !== "All events" && e.category !== auditFilter) return false;
    if (auditActor && !e.actor.toLowerCase().includes(auditActor.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <Panel
        title="Sign-in policies"
        subtitle="Org-wide rules that apply to every member's account."
      >
        <SecurityRow
          title="Restrict sign-in to approved domains"
          desc={
            <>
              Only allow new members from{" "}
              {displayDomains.map((d, i) => (
                <span
                  key={d}
                  style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 12,
                    background: "var(--s2)",
                    padding: "1px 6px",
                    borderRadius: 4,
                    marginRight: i < displayDomains.length - 1 ? 4 : 0,
                  }}
                >
                  @{d}
                </span>
              ))}
              . Existing members with other domains are unaffected.
            </>
          }
          control={
            <Toggle
              on={domainLock}
              onChange={toggleDomainLock}
              ariaLabel="Domain restriction"
            />
          }
          first
        />
        <SecurityRow
          title="Session timeout"
          desc={
            contractor
              ? "How long a session stays active before sign-in is required again. Preference is stored now; per-org enforcement lands when the session-lifecycle hook ships."
              : "How long a session stays active before sign-in is required again."
          }
          control={
            <select
              style={{ ...fieldStyle(), width: 180 }}
              value={sessionTimeout}
              onChange={(e) => updateSessionTimeout(e.target.value)}
              disabled={!canManage || securitySaving}
            >
              <option value="60">1 hour</option>
              <option value="480">8 hours</option>
              <option value="720">12 hours</option>
              <option value="1440">24 hours</option>
              <option value="10080">7 days (default)</option>
            </select>
          }
        />
        {(securityError || securitySavedAt) && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: 12.5,
              fontWeight: 580,
              background: securityError ? "var(--dg-s)" : "var(--ok-s)",
              border: `1px solid ${securityError ? "var(--dg)" : "var(--ok)"}`,
              color: securityError ? "var(--dg-t)" : "var(--ok-t)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {securityError ? I.warn : I.check}
            {securityError ?? "Security settings saved"}
          </div>
        )}
        <SecurityRow
          title={
            <>
              Require 2FA for all members <Pill tone="accent">Enterprise</Pill>
            </>
          }
          desc="Force every member to enable two-factor authentication before they can sign in."
          control={
            <button style={{ ...btnGhostSm(), cursor: "not-allowed", opacity: 0.7 }} disabled>
              Upgrade to enable
            </button>
          }
          last
        />
      </Panel>

      <Panel
        title="Single sign-on (SSO)"
        subtitle="Connect your identity provider for SAML-based authentication."
        headerRight={<Pill tone="accent">Enterprise</Pill>}
      >
        <SecurityRow
          title={
            <>
              SAML 2.0 SSO{" "}
              <Pill tone={ssoEnabled ? "ok" : undefined}>
                {ssoEnabled ? "Connected" : "Not connected"}
              </Pill>
            </>
          }
          desc="Compatible with Okta, Azure AD, Google Workspace, OneLogin, and any SAML 2.0–compliant IdP."
          control={
            <button style={btnGhostSm()} onClick={() => setSsoDrawerOpen((v) => !v)}>
              {ssoDrawerOpen ? "Close" : "Configure"}
            </button>
          }
          first
          last
        />
        {ssoDrawerOpen && (
          <div
            style={{
              background: "var(--s2)",
              borderRadius: 14,
              padding: 16,
              marginTop: 12,
              animation: "fadeIn .24s cubic-bezier(.16,1,.3,1)",
            }}
          >
            <h5
              style={{
                fontFamily: "'DM Sans',system-ui,sans-serif",
                fontSize: 13,
                fontWeight: 700,
                margin: 0,
                marginBottom: 6,
              }}
            >
              Service provider details
            </h5>
            <Field label="Entity ID (SP)">
              <input
                readOnly
                style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace" }}
                value="https://app.builtcrm.com/sso/saml/summitcontracting"
              />
            </Field>
            <Field label="ACS URL (Reply URL)">
              <input
                readOnly
                style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace" }}
                value="https://app.builtcrm.com/sso/saml/summitcontracting/acs"
              />
            </Field>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  fontSize: 12,
                  fontWeight: 650,
                  color: "var(--t2)",
                  letterSpacing: ".01em",
                }}
              >
                Metadata XML
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={btnGhostSm()}>
                  <span style={{ marginRight: 4 }}>{I.download}</span>Download metadata
                </button>
                <button style={{ ...btnPrimarySm(false), cursor: "not-allowed" }} disabled>
                  Upload IdP metadata
                </button>
              </div>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="Audit log"
        subtitle="An immutable record of every security-relevant action in your organization. Retained for 2 years."
        headerRight={
          <button style={btnGhostSm()}>
            <span style={{ marginRight: 4 }}>{I.download}</span>Export log
          </button>
        }
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 14,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <select
            value={auditFilter}
            onChange={(e) => setAuditFilter(e.target.value)}
            style={{ ...fieldStyle(), height: 34, width: "auto", fontSize: 12.5 }}
          >
            {categories.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            placeholder="Filter by actor..."
            value={auditActor}
            onChange={(e) => setAuditActor(e.target.value)}
            style={{ ...fieldStyle(), height: 34, width: 220, fontSize: 12.5 }}
          />
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontSize: 12,
              color: "var(--t3)",
              fontFamily: "'JetBrains Mono',monospace",
            }}
          >
            {filteredAudit.length} events
          </span>
        </div>

        {filteredAudit.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--t3)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            No events match your filters.
          </div>
        ) : (
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  {["Time", "Actor", "Event", "Detail", "IP"].map((h) => (
                    <th
                      key={h}
                      style={{
                        fontFamily: "'DM Sans',system-ui,sans-serif",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--t3)",
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                        textAlign: "left",
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--s3)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAudit.map((e, idx) => (
                  <tr key={idx}>
                    <td
                      style={{
                        padding: "14px 12px",
                        borderBottom: "1px solid var(--s2)",
                        color: "var(--t2)",
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono',monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.time}
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        borderBottom: "1px solid var(--s2)",
                        fontSize: 13,
                      }}
                    >
                      {e.actor}
                    </td>
                    <td style={{ padding: "14px 12px", borderBottom: "1px solid var(--s2)" }}>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: 11.5,
                          color: "var(--ac-t)",
                          background: "var(--ac-s)",
                          padding: "2px 8px",
                          borderRadius: 6,
                          display: "inline-block",
                          fontWeight: 600,
                        }}
                      >
                        {e.event}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        borderBottom: "1px solid var(--s2)",
                        color: "var(--t2)",
                        fontSize: 12.5,
                      }}
                    >
                      {e.detail}
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        borderBottom: "1px solid var(--s2)",
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 11.5,
                        color: "var(--t3)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.ip}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

function SecurityRow({
  title,
  desc,
  control,
  first,
  last,
}: {
  title: ReactNode;
  desc: ReactNode;
  control: ReactNode;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        padding: first ? "0 0 16px" : last ? "16px 0 0" : "16px 0",
        borderBottom: last ? "none" : "1px solid var(--s2)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 220 }}>
        <div
          style={{
            fontFamily: "'DM Sans',system-ui,sans-serif",
            fontSize: 14,
            fontWeight: 650,
            letterSpacing: "-.01em",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--t2)",
            marginTop: 4,
            lineHeight: 1.45,
            fontWeight: 500,
          }}
        >
          {desc}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );
}

// ═══════ CONTRACTOR: TEAM & ROLES (LIVE) ═══════════════════════════════
// The live path — wired to real loaders + API routes. Uses real UUIDs
// instead of numeric IDs. Membership filter: only "active" rows render
// (soft-removed rows stay in DB for audit but hide from the table).
function ContractorTeamRolesLiveTab({
  contractor,
}: {
  contractor: ContractorSettingsBundle;
}) {
  const router = useRouter();
  const [memberSearch, setMemberSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("pm");
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [roleExplainer, setRoleExplainer] = useState(false);
  const [banner, setBanner] = useState<
    { kind: "error" | "success"; text: string } | null
  >(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const canManage = contractor.role === "contractor_admin";
  const visibleMembers = contractor.members.filter(
    (m) => m.membershipStatus === "active",
  );
  const filteredMembers = visibleMembers.filter(
    (m) =>
      !memberSearch ||
      m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearch.toLowerCase()),
  );
  const pendingInvites = contractor.invitations.filter(
    (i) => i.status === "pending" || i.status === "expired",
  );

  function flash(kind: "error" | "success", text: string) {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 3500);
  }

  async function changeRole(userId: string, newRoleKey: string) {
    setPending((p) => ({ ...p, [`role:${userId}`]: true }));
    const res = await fetch(`/api/org/members/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleKey: newRoleKey }),
    });
    setPending((p) => ({ ...p, [`role:${userId}`]: false }));
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      flash("error", body.message ?? body.error ?? "Could not change role.");
      return;
    }
    router.refresh();
  }

  async function removeMember(userId: string) {
    setPending((p) => ({ ...p, [`remove:${userId}`]: true }));
    const res = await fetch(`/api/org/members/${userId}`, { method: "DELETE" });
    setPending((p) => ({ ...p, [`remove:${userId}`]: false }));
    setRemoveConfirm(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      flash("error", body.message ?? body.error ?? "Could not remove member.");
      return;
    }
    flash("success", "Member removed.");
    router.refresh();
  }

  async function sendInvite() {
    if (!inviteEmail) return;
    setPending((p) => ({ ...p, invite: true }));
    const res = await fetch(`/api/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invitedEmail: inviteEmail,
        portalType: "contractor",
        roleKey: inviteRole,
      }),
    });
    setPending((p) => ({ ...p, invite: false }));
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      flash("error", body.message ?? body.error ?? "Could not send invite.");
      return;
    }
    setInviteEmail("");
    setInviteRole("pm");
    setShowInvite(false);
    flash("success", "Invitation sent.");
    router.refresh();
  }

  async function cancelInvite(invitationId: string) {
    setPending((p) => ({ ...p, [`cancel:${invitationId}`]: true }));
    const res = await fetch(`/api/org/invitations/${invitationId}`, {
      method: "DELETE",
    });
    setPending((p) => ({ ...p, [`cancel:${invitationId}`]: false }));
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      flash("error", body.message ?? body.error ?? "Could not cancel invite.");
      return;
    }
    flash("success", "Invitation revoked.");
    router.refresh();
  }

  async function resendInvite(invitationId: string) {
    setPending((p) => ({ ...p, [`resend:${invitationId}`]: true }));
    const res = await fetch(`/api/org/invitations/${invitationId}/resend`, {
      method: "POST",
    });
    setPending((p) => ({ ...p, [`resend:${invitationId}`]: false }));
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      flash("error", body.message ?? body.error ?? "Could not resend invite.");
      return;
    }
    flash("success", "Invitation resent.");
    router.refresh();
  }

  return (
    <>
      <Panel
        title="Roles"
        subtitle="How permissions are organized. Admins can change any member's role; Admin cannot demote themselves if they're the last one."
        headerRight={
          <button style={btnGhostSm()} onClick={() => setRoleExplainer((v) => !v)}>
            {roleExplainer ? "Hide details" : "Show details"}
          </button>
        }
      >
        {roleExplainer && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
              gap: 10,
              marginTop: 4,
            }}
          >
            {TEAM_ROLES.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: "12px 14px",
                  border: "1px solid var(--s3)",
                  borderRadius: 10,
                  background: "var(--s1)",
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    fontSize: 13,
                    fontWeight: 650,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  {r.label}
                  <Pill tone={r.scope === "org" ? "accent" : "info"}>
                    {r.scope === "org" ? "Org-wide" : "Per-project"}
                  </Pill>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--t3)", lineHeight: 1.45, fontWeight: 500 }}>
                  {r.desc}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={`Members (${visibleMembers.length})`}
        subtitle="Everyone in your organization with access to BuiltCRM. Changes apply on their next request."
        headerRight={
          canManage ? (
            <button style={btnPrimarySm(true)} onClick={() => setShowInvite((v) => !v)}>
              {showInvite ? "Cancel" : (
                <>
                  <span style={{ marginRight: 4 }}>{I.plus}</span>Invite member
                </>
              )}
            </button>
          ) : null
        }
      >
        {showInvite && canManage && (
          <div
            style={{
              background: "var(--ac-s)",
              border: "1px solid var(--ac-m)",
              borderRadius: 14,
              padding: 18,
              marginBottom: 12,
              display: "grid",
              gridTemplateColumns: "2fr 1fr auto auto",
              gap: 10,
              alignItems: "end",
            }}
          >
            <Field label="Email address">
              <input
                type="email"
                placeholder={`new.member@${contractor.orgName.toLowerCase().replace(/\s+/g, "")}.com`}
                style={fieldStyle()}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </Field>
            <Field label="Role">
              <select style={fieldStyle()} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                {TEAM_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <button style={btnGhostSm()} onClick={() => setShowInvite(false)}>
              Cancel
            </button>
            <button
              style={btnPrimarySm(Boolean(inviteEmail) && !pending.invite)}
              onClick={sendInvite}
              disabled={!inviteEmail || pending.invite}
            >
              {pending.invite ? "Sending…" : "Send invite"}
            </button>
          </div>
        )}

        <div style={{ position: "relative", maxWidth: 320, marginBottom: 14 }}>
          <span
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--t3)",
              pointerEvents: "none",
              display: "flex",
            }}
          >
            {I.search}
          </span>
          <input
            placeholder="Search members by name or email..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            style={{ ...fieldStyle(), height: 36, paddingLeft: 34 }}
          />
        </div>

        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                {["Member", "Role", "Last active", ""].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      fontFamily: "'DM Sans',system-ui,sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--t3)",
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                      textAlign: i === 3 ? "right" : "left",
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--s3)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => {
                const isSelf = m.userId === contractor.currentUserId;
                return (
                  <tr key={m.id}>
                    <td
                      style={{
                        padding: "14px 12px",
                        borderBottom: "1px solid var(--s2)",
                        fontSize: 13.5,
                        verticalAlign: "middle",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg,var(--ac),var(--ac-m))",
                            color: "white",
                            display: "grid",
                            placeItems: "center",
                            fontFamily: "'DM Sans',system-ui,sans-serif",
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {m.initials}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: "'DM Sans',system-ui,sans-serif",
                              fontSize: 13.5,
                              fontWeight: 650,
                              letterSpacing: "-.01em",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            {m.name}
                            {isSelf && <Pill tone="accent">You</Pill>}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2, fontWeight: 500 }}>
                            {m.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 12px", borderBottom: "1px solid var(--s2)" }}>
                      {canManage && !isSelf ? (
                        <select
                          value={m.roleKey}
                          onChange={(e) => changeRole(m.userId, e.target.value)}
                          disabled={pending[`role:${m.userId}`]}
                          style={{
                            ...fieldStyle(),
                            height: 32,
                            width: "auto",
                            fontSize: 12.5,
                            padding: "0 28px 0 10px",
                          }}
                        >
                          {TEAM_ROLES.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                          {!TEAM_ROLES.find((r) => r.id === m.roleKey) && (
                            <option value={m.roleKey}>{m.roleKey}</option>
                          )}
                        </select>
                      ) : (
                        <span
                          style={{
                            fontSize: 12.5,
                            color: "var(--t2)",
                            fontWeight: 520,
                          }}
                        >
                          {TEAM_ROLES.find((r) => r.id === m.roleKey)?.label ?? m.roleKey}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        borderBottom: "1px solid var(--s2)",
                        color: "var(--t2)",
                        fontSize: 12.5,
                      }}
                    >
                      {m.lastActiveAt ? formatRelativeTime(m.lastActiveAt) : "—"}
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        borderBottom: "1px solid var(--s2)",
                        textAlign: "right",
                      }}
                    >
                      {canManage && !isSelf && (
                        <button
                          style={{ ...btnGhostSm(), color: "var(--dg)" }}
                          onClick={() => setRemoveConfirm(m.userId)}
                          disabled={pending[`remove:${m.userId}`]}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredMembers.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: "center",
                      padding: 24,
                      color: "var(--t3)",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {memberSearch
                      ? `No members match “${memberSearch}”`
                      : "No members in this organization yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {banner && (
          <div
            style={{
              background:
                banner.kind === "error" ? "var(--dg-s)" : "var(--ok-s)",
              border: `1px solid ${banner.kind === "error" ? "var(--dg)" : "var(--ok)"}`,
              borderRadius: 12,
              padding: "10px 14px",
              marginTop: 10,
              fontSize: 12.5,
              color: banner.kind === "error" ? "var(--dg-t)" : "var(--ok-t)",
              fontWeight: 580,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {banner.kind === "error" ? I.warn : I.check}
            {banner.text}
          </div>
        )}

        {removeConfirm && (() => {
          const target = contractor.members.find((m) => m.userId === removeConfirm);
          if (!target) return null;
          return (
            <div
              style={{
                background: "var(--dg-s)",
                border: "1px solid var(--dg)",
                borderRadius: 14,
                padding: 14,
                marginTop: 4,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--dg)",
                  fontWeight: 580,
                  flex: 1,
                  minWidth: 200,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {I.warn}
                Remove <strong>{target.name}</strong> from the organization? Their
                membership row will be soft-removed — records they created stay
                attached to the projects.
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={btnGhostSm()} onClick={() => setRemoveConfirm(null)}>
                  Cancel
                </button>
                <button
                  style={btnDangerSm()}
                  onClick={() => removeMember(removeConfirm)}
                  disabled={pending[`remove:${removeConfirm}`]}
                >
                  {pending[`remove:${removeConfirm}`] ? "Removing…" : "Confirm remove"}
                </button>
              </div>
            </div>
          );
        })()}
      </Panel>

      {pendingInvites.length > 0 && (
        <Panel
          title={`Pending invites (${pendingInvites.length})`}
          subtitle="People who've been invited but haven't accepted yet."
        >
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr>
                  {["Email", "Role", "Status", ""].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        fontFamily: "'DM Sans',system-ui,sans-serif",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--t3)",
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                        textAlign: i === 3 ? "right" : "left",
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--s3)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((inv) => (
                  <tr key={inv.id}>
                    <td
                      style={{
                        padding: "14px 12px",
                        borderBottom: "1px solid var(--s2)",
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 12.5,
                      }}
                    >
                      {inv.invitedEmail}
                    </td>
                    <td style={{ padding: "14px 12px", borderBottom: "1px solid var(--s2)" }}>
                      <Pill>{TEAM_ROLES.find((r) => r.id === inv.roleKey)?.label ?? inv.roleKey}</Pill>
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        borderBottom: "1px solid var(--s2)",
                        color: "var(--t2)",
                        fontSize: 12.5,
                      }}
                    >
                      {inv.status === "expired" ? (
                        <Pill tone="warn">Expired</Pill>
                      ) : (
                        <span>
                          Expires {formatRelativeTime(inv.expiresAt)}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        borderBottom: "1px solid var(--s2)",
                        textAlign: "right",
                      }}
                    >
                      {canManage && (
                        <>
                          <button
                            style={btnGhostSm()}
                            onClick={() => resendInvite(inv.id)}
                            disabled={pending[`resend:${inv.id}`]}
                          >
                            {pending[`resend:${inv.id}`] ? "…" : "Resend"}
                          </button>
                          <button
                            style={{ ...btnGhostSm(), color: "var(--dg)", marginLeft: 4 }}
                            onClick={() => cancelInvite(inv.id)}
                            disabled={pending[`cancel:${inv.id}`]}
                          >
                            {pending[`cancel:${inv.id}`] ? "…" : "Cancel"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

// ═══════ CONTRACTOR: ORGANIZATION (LIVE) ═══════════════════════════════
// Live variant of the Organization tab — wired to real loaders + API routes.
// Gated on contractor.orgProfile being present.

type LiveOrgForm = {
  displayName: string;
  legalName: string;
  taxId: string;
  website: string;
  phone: string;
  addr1: string;
  addr2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  primaryContactName: string;
  billingContactName: string;
  billingEmail: string;
};
function profileToForm(p: OrganizationProfile): LiveOrgForm {
  return {
    displayName: p.displayName,
    legalName: p.legalName ?? "",
    taxId: p.taxId ?? "",
    website: p.website ?? "",
    phone: p.phone ?? "",
    addr1: p.addr1 ?? "",
    addr2: p.addr2 ?? "",
    city: p.city ?? "",
    stateRegion: p.stateRegion ?? "",
    postalCode: p.postalCode ?? "",
    country: p.country ?? "United States",
    primaryContactName: p.primaryContactName ?? "",
    billingContactName: p.billingContactName ?? "",
    billingEmail: p.billingEmail ?? "",
  };
}
// Strings from an empty input come through as "" — convert back to null so the
// DB stores NULL rather than whitespace, matching the PATCH route's own
// normalization rules.
function formToPatch(f: LiveOrgForm): Record<string, string | null> {
  return {
    displayName: f.displayName,
    legalName: f.legalName || null,
    taxId: f.taxId || null,
    website: f.website || null,
    phone: f.phone || null,
    addr1: f.addr1 || null,
    addr2: f.addr2 || null,
    city: f.city || null,
    stateRegion: f.stateRegion || null,
    postalCode: f.postalCode || null,
    country: f.country || null,
    primaryContactName: f.primaryContactName || null,
    billingContactName: f.billingContactName || null,
    billingEmail: f.billingEmail || null,
  };
}

function ContractorOrganizationLiveTab({
  contractor,
}: {
  contractor: ContractorSettingsBundle;
}) {
  const router = useRouter();
  const profile = contractor.orgProfile!;
  const canManage = contractor.role === "contractor_admin";

  const initialForm = profileToForm(profile);
  const [org, setOrg] = useState<LiveOrgForm>(initialForm);
  const [logoStorageKey, setLogoStorageKey] = useState<string | null>(
    profile.logoStorageKey,
  );
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    profile.logoPreviewUrl,
  );
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Logo upload
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Licenses
  const [showAddLicense, setShowAddLicense] = useState(false);
  const [addingLicense, setAddingLicense] = useState(false);
  const [licenseForm, setLicenseForm] = useState({
    kind: "",
    licenseNumber: "",
    stateRegion: "",
    expiresOn: "",
  });
  const [licensePending, setLicensePending] = useState<Record<string, boolean>>({});
  const [licenseError, setLicenseError] = useState<string | null>(null);

  function update<K extends keyof LiveOrgForm>(k: K, v: LiveOrgForm[K]) {
    setOrg((p) => ({ ...p, [k]: v }));
    setDirty(true);
    setSaved(false);
    setError(null);
  }

  const initials = (org.displayName || contractor.orgName)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/org/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPatch(org)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? body.error ?? "save_failed");
        return;
      }
      setDirty(false);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2400);
    } finally {
      setSaving(false);
    }
  }
  function discard() {
    setOrg(initialForm);
    setDirty(false);
    setError(null);
  }

  async function handleLogoUpload(file: File) {
    setLogoError(null);
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("File is larger than 2MB.");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/i.test(file.type)) {
      setLogoError("Only PNG, JPEG, WEBP, or SVG are allowed.");
      return;
    }
    setLogoUploading(true);
    try {
      const pre = await fetch("/api/org/logo/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!pre.ok) {
        const body = await pre.json().catch(() => ({}));
        setLogoError(body.message ?? body.error ?? "presign_failed");
        return;
      }
      const { uploadUrl, storageKey } = await pre.json();
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        setLogoError(`Upload failed (${put.status})`);
        return;
      }
      const fin = await fetch("/api/org/logo/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey }),
      });
      if (!fin.ok) {
        const body = await fin.json().catch(() => ({}));
        setLogoError(body.message ?? body.error ?? "finalize_failed");
        return;
      }
      const data = await fin.json();
      setLogoStorageKey(data.storageKey);
      setLogoPreviewUrl(data.previewUrl ?? null);
      router.refresh();
    } finally {
      setLogoUploading(false);
    }
  }
  async function handleLogoRemove() {
    setLogoError(null);
    setLogoUploading(true);
    try {
      const res = await fetch("/api/org/logo/finalize", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLogoError(body.message ?? body.error ?? "remove_failed");
        return;
      }
      setLogoStorageKey(null);
      setLogoPreviewUrl(null);
      router.refresh();
    } finally {
      setLogoUploading(false);
    }
  }

  async function addLicense() {
    if (!licenseForm.kind || !licenseForm.licenseNumber) return;
    setAddingLicense(true);
    setLicenseError(null);
    try {
      const res = await fetch("/api/org/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: licenseForm.kind,
          licenseNumber: licenseForm.licenseNumber,
          stateRegion: licenseForm.stateRegion || null,
          expiresOn: licenseForm.expiresOn || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLicenseError(body.message ?? body.error ?? "add_failed");
        return;
      }
      setLicenseForm({ kind: "", licenseNumber: "", stateRegion: "", expiresOn: "" });
      setShowAddLicense(false);
      router.refresh();
    } finally {
      setAddingLicense(false);
    }
  }
  async function removeLicense(id: string) {
    setLicensePending((p) => ({ ...p, [id]: true }));
    setLicenseError(null);
    try {
      const res = await fetch(`/api/org/licenses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLicenseError(body.message ?? body.error ?? "remove_failed");
        return;
      }
      router.refresh();
    } finally {
      setLicensePending((p) => ({ ...p, [id]: false }));
    }
  }

  return (
    <>
      <Panel
        title="Company logo"
        subtitle="Shown in the sidebar, on client-facing documents, and on invoices."
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 14,
              background: logoPreviewUrl
                ? `url(${logoPreviewUrl}) center/cover no-repeat`
                : "linear-gradient(135deg,var(--ac),var(--ac-m))",
              color: "white",
              display: "grid",
              placeItems: "center",
              fontFamily: "'DM Sans',system-ui,sans-serif",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: "-.04em",
              flexShrink: 0,
            }}
          >
            {!logoPreviewUrl && initials}
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 8, fontWeight: 500 }}>
              PNG, JPEG, WEBP, or SVG · square, up to 2 MB · 512×512 recommended
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
                e.target.value = "";
              }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                style={btnGhostSm()}
                disabled={!canManage || logoUploading}
                onClick={() => logoInputRef.current?.click()}
              >
                {logoUploading ? "Uploading…" : (
                  <>
                    <span style={{ marginRight: 6 }}>{I.upload}</span>Upload logo
                  </>
                )}
              </button>
              {logoStorageKey && (
                <button
                  style={btnGhostSm()}
                  onClick={handleLogoRemove}
                  disabled={!canManage || logoUploading}
                >
                  Remove
                </button>
              )}
            </div>
            {logoError && (
              <div style={{ fontSize: 12, color: "var(--dg-t)", marginTop: 6, fontWeight: 520 }}>
                {logoError}
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title="Company information"
        subtitle="How your organization appears across the app and on official documents."
      >
        <FieldRow>
          <Field label="Display name" help="Shown in the app and to your team">
            <input
              style={fieldStyle()}
              value={org.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
          <Field label="Legal name" help="Used on invoices, W-9s, and contracts">
            <input
              style={fieldStyle()}
              value={org.legalName}
              onChange={(e) => update("legalName", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Tax ID (EIN)" help="Stored encrypted at the disk layer; admin-only access.">
            <input
              style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".02em" }}
              value={org.taxId}
              onChange={(e) => update("taxId", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
          <Field label="Website">
            <input
              type="url"
              style={fieldStyle()}
              value={org.website}
              onChange={(e) => update("website", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
        </FieldRow>
        <Field label="Main phone">
          <input
            type="tel"
            style={fieldStyle()}
            value={org.phone}
            onChange={(e) => update("phone", e.target.value)}
            readOnly={!canManage}
          />
        </Field>
      </Panel>

      <Panel title="Business address" subtitle="Used on invoices, mailing, and tax forms.">
        <Field label="Street address">
          <input style={fieldStyle()} value={org.addr1} onChange={(e) => update("addr1", e.target.value)} readOnly={!canManage} />
        </Field>
        <Field label="Suite / unit (optional)">
          <input style={fieldStyle()} value={org.addr2} onChange={(e) => update("addr2", e.target.value)} readOnly={!canManage} />
        </Field>
        <div
          className="addr-row-live"
          style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}
        >
          <style>{`@media (max-width: 620px) { .addr-row-live { grid-template-columns: 1fr !important; } }`}</style>
          <Field label="City">
            <input style={fieldStyle()} value={org.city} onChange={(e) => update("city", e.target.value)} readOnly={!canManage} />
          </Field>
          <Field label="State / province">
            <input style={fieldStyle()} value={org.stateRegion} onChange={(e) => update("stateRegion", e.target.value)} readOnly={!canManage} />
          </Field>
          <Field label="ZIP / postal">
            <input
              style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".02em" }}
              value={org.postalCode}
              onChange={(e) => update("postalCode", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
        </div>
        <Field label="Country">
          <select
            style={fieldStyle()}
            value={org.country || "United States"}
            onChange={(e) => update("country", e.target.value)}
            disabled={!canManage}
          >
            <option>United States</option>
            <option>Canada</option>
            <option>Mexico</option>
          </select>
        </Field>
      </Panel>

      <Panel title="Contacts" subtitle="Primary and billing contacts for your organization.">
        <FieldRow>
          <Field label="Primary contact" help="Default point of contact for inbound queries">
            <input
              style={fieldStyle()}
              value={org.primaryContactName}
              onChange={(e) => update("primaryContactName", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
          <Field label="Billing contact">
            <input
              style={fieldStyle()}
              value={org.billingContactName}
              onChange={(e) => update("billingContactName", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
        </FieldRow>
        <Field label="Billing email" help="Where invoice PDFs and receipts are sent">
          <input
            type="email"
            style={fieldStyle()}
            value={org.billingEmail}
            onChange={(e) => update("billingEmail", e.target.value)}
            readOnly={!canManage}
          />
        </Field>
      </Panel>

      <Panel
        title="Licenses & credentials"
        subtitle="Licensing information shown on client-facing documents and used for compliance verification."
        headerRight={
          canManage ? (
            <button style={btnGhostSm()} onClick={() => setShowAddLicense((v) => !v)}>
              <span style={{ marginRight: 4 }}>{I.plus}</span>
              {showAddLicense ? "Cancel" : "Add license"}
            </button>
          ) : null
        }
      >
        {showAddLicense && canManage && (
          <div
            style={{
              background: "var(--ac-s)",
              border: "1px solid var(--ac-m)",
              borderRadius: 14,
              padding: 18,
              marginBottom: 12,
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
              gap: 10,
              alignItems: "end",
            }}
          >
            <style>{`@media (max-width: 820px) { [data-license-add] { grid-template-columns: 1fr 1fr !important; } }`}</style>
            <Field label="License kind">
              <input
                placeholder="e.g. General Contractor (CSLB)"
                style={fieldStyle()}
                value={licenseForm.kind}
                onChange={(e) => setLicenseForm({ ...licenseForm, kind: e.target.value })}
              />
            </Field>
            <Field label="License number">
              <input
                placeholder="B-1089432"
                style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace" }}
                value={licenseForm.licenseNumber}
                onChange={(e) => setLicenseForm({ ...licenseForm, licenseNumber: e.target.value })}
              />
            </Field>
            <Field label="State / region">
              <input
                placeholder="CA"
                style={fieldStyle()}
                value={licenseForm.stateRegion}
                onChange={(e) => setLicenseForm({ ...licenseForm, stateRegion: e.target.value })}
              />
            </Field>
            <Field label="Expires on">
              <input
                type="date"
                style={fieldStyle()}
                value={licenseForm.expiresOn}
                onChange={(e) => setLicenseForm({ ...licenseForm, expiresOn: e.target.value })}
              />
            </Field>
            <button
              style={btnPrimarySm(
                Boolean(licenseForm.kind && licenseForm.licenseNumber) && !addingLicense,
              )}
              onClick={addLicense}
              disabled={!licenseForm.kind || !licenseForm.licenseNumber || addingLicense}
            >
              {addingLicense ? "Adding…" : "Add"}
            </button>
          </div>
        )}

        {contractor.orgLicenses.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: "var(--t3)",
              fontSize: 13,
              fontWeight: 500,
              border: "1px dashed var(--s3)",
              borderRadius: 12,
            }}
          >
            No licenses added yet.
          </div>
        ) : (
          contractor.orgLicenses.map((l) => (
            <div
              key={l.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: 14,
                border: "1px solid var(--s3)",
                borderRadius: 14,
                marginBottom: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    fontSize: 13.5,
                    fontWeight: 650,
                    letterSpacing: "-.01em",
                  }}
                >
                  {l.kind}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--t3)",
                    marginTop: 3,
                    fontWeight: 500,
                    fontFamily: "'JetBrains Mono',monospace",
                  }}
                >
                  {l.licenseNumber}
                  {l.stateRegion && <> · {l.stateRegion}</>}
                  {l.expiresOn && <> · Expires {l.expiresOn}</>}
                </div>
              </div>
              {canManage && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    style={{ ...btnGhostSm(), color: "var(--dg)" }}
                    aria-label="Remove license"
                    onClick={() => removeLicense(l.id)}
                    disabled={licensePending[l.id]}
                  >
                    {licensePending[l.id] ? "…" : I.x}
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {licenseError && (
          <div
            style={{
              background: "var(--dg-s)",
              border: "1px solid var(--dg)",
              borderRadius: 12,
              padding: "10px 14px",
              marginTop: 10,
              fontSize: 12.5,
              color: "var(--dg-t)",
              fontWeight: 580,
            }}
          >
            {licenseError}
          </div>
        )}
      </Panel>

      {(dirty || saved || error) && (
        <SaveBar
          state={error ? "dirty" : saved ? "success" : "dirty"}
          message={
            error
              ? error
              : saved
                ? "Organization saved"
                : "You have unsaved changes"
          }
          showActions={!saved && !error}
          onDiscard={discard}
          onSave={save}
          saving={saving}
        />
      )}
    </>
  );
}

function formatAuditTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const mm = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const tt = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${mm} · ${tt}`;
}

// ═══════ SUBCONTRACTOR: ORGANIZATION TAB ═══════════════════════════════
const TRADE_OPTIONS = [
  "Electrical",
  "Plumbing",
  "HVAC / Mechanical",
  "Framing / Carpentry",
  "Concrete / Foundations",
  "Roofing",
  "Drywall",
  "Flooring",
  "Painting",
  "Masonry",
  "Landscaping",
  "Low Voltage / Data",
  "General MEP",
  "Other",
] as const;

const REGION_OPTIONS = [
  "San Francisco Bay Area",
  "East Bay",
  "Peninsula / South Bay",
  "Sacramento Metro",
  "Central Valley",
  "Northern California (other)",
] as const;

const CREW_SIZE_OPTIONS = ["1–3", "4–7", "8–15", "16–30", "30+"] as const;

type SubOrgForm = {
  legalName: string;
  displayName: string;
  primaryTrade: string;
  secondaryTrades: string[];
  yearsInBusiness: string;
  ein: string;
  website: string;
  phone: string;
  addr1: string;
  addr2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  crewSize: string;
  regions: string[];
  primaryContactName: string;
  primaryContactTitle: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
};

const SUB_ORG_DEFAULTS: SubOrgForm = {
  legalName: "Northline Electrical LLC",
  displayName: "Northline Electrical",
  primaryTrade: "Electrical",
  secondaryTrades: ["Low Voltage / Data"],
  yearsInBusiness: "12",
  ein: "46-3987210",
  website: "https://northline-electric.com",
  phone: "+1 (415) 555-0184",
  addr1: "889 McAllister Street",
  addr2: "",
  city: "San Francisco",
  state: "CA",
  zip: "94102",
  country: "United States",
  crewSize: "8–15",
  regions: ["San Francisco Bay Area", "Peninsula / South Bay"],
  primaryContactName: "Alex Morales",
  primaryContactTitle: "Owner / Principal",
  primaryContactEmail: "alex@northline-electric.com",
  primaryContactPhone: "+1 (415) 555-0185",
};

const SUB_ORG_LICENSES: OrgLicense[] = [
  { id: 1, kind: "C-10 Electrical Contractor (CSLB)", number: "C10-1048221", state: "CA", expires: "2027-06-30" },
  { id: 2, kind: "Low Voltage C-7 Endorsement", number: "C7-4401991", state: "CA", expires: "2026-11-15" },
];

function SubcontractorOrganizationTab({
  subcontractor,
}: {
  subcontractor?: SubcontractorSettingsBundle;
}) {
  if (subcontractor?.orgProfile) {
    return <SubcontractorOrganizationLiveTab subcontractor={subcontractor} />;
  }
  return <SubcontractorOrganizationSampleTab />;
}

function SubcontractorOrganizationSampleTab() {
  const [org, setOrg] = useState<SubOrgForm>(SUB_ORG_DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof SubOrgForm>(k: K, v: SubOrgForm[K]) {
    setOrg((p) => ({ ...p, [k]: v }));
    setDirty(true);
    setSaved(false);
  }

  function toggleSecondary(t: string) {
    const has = org.secondaryTrades.includes(t);
    update(
      "secondaryTrades",
      has ? org.secondaryTrades.filter((x) => x !== t) : [...org.secondaryTrades, t],
    );
  }

  function toggleRegion(r: string) {
    const has = org.regions.includes(r);
    update("regions", has ? org.regions.filter((x) => x !== r) : [...org.regions, r]);
  }

  const initials = org.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      <Panel
        title="Company logo"
        subtitle="Shown on certificates of insurance, pay applications, and in your GC's view."
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 14,
              background: "linear-gradient(135deg,#1a2e3e,var(--ac))",
              color: "white",
              display: "grid",
              placeItems: "center",
              fontFamily: "'DM Sans',system-ui,sans-serif",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: "-.04em",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 8, fontWeight: 500 }}>
              PNG or SVG · square, up to 2 MB · 512×512 recommended
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={btnGhostSm()}>
                <span style={{ marginRight: 6 }}>{I.upload}</span>Upload logo
              </button>
              <button style={btnGhostSm()}>Remove</button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Company information"
        subtitle="How your company appears to GCs and on official documents."
      >
        <FieldRow>
          <Field label="Display name" help="What GCs see in lists and assignments">
            <input style={fieldStyle()} value={org.displayName} onChange={(e) => update("displayName", e.target.value)} />
          </Field>
          <Field label="Legal name" help="Used on invoices, W-9s, and contracts">
            <input style={fieldStyle()} value={org.legalName} onChange={(e) => update("legalName", e.target.value)} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Primary trade" help="Your main scope — sets notification defaults">
            <select style={fieldStyle()} value={org.primaryTrade} onChange={(e) => update("primaryTrade", e.target.value)}>
              {TRADE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Years in business">
            <input
              style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".02em" }}
              value={org.yearsInBusiness}
              onChange={(e) => update("yearsInBusiness", e.target.value)}
            />
          </Field>
        </FieldRow>

        <Field
          label="Secondary trades (optional)"
          help="Trades you can also self-perform — used when GCs search for subs"
        >
          <ChipList
            options={TRADE_OPTIONS.filter((t) => t !== org.primaryTrade) as readonly string[]}
            selected={org.secondaryTrades}
            onToggle={toggleSecondary}
          />
        </Field>

        <FieldRow>
          <Field label="Tax ID (EIN)">
            <input
              style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".02em" }}
              value={org.ein}
              onChange={(e) => update("ein", e.target.value)}
            />
          </Field>
          <Field label="Website">
            <input type="url" style={fieldStyle()} value={org.website} onChange={(e) => update("website", e.target.value)} />
          </Field>
        </FieldRow>
        <Field label="Main phone">
          <input type="tel" style={fieldStyle()} value={org.phone} onChange={(e) => update("phone", e.target.value)} />
        </Field>
      </Panel>

      <Panel
        title="Business address"
        subtitle="Used on W-9s, certificates of insurance, and official correspondence."
      >
        <Field label="Street address">
          <input style={fieldStyle()} value={org.addr1} onChange={(e) => update("addr1", e.target.value)} />
        </Field>
        <Field label="Suite / unit (optional)">
          <input style={fieldStyle()} value={org.addr2} onChange={(e) => update("addr2", e.target.value)} />
        </Field>
        <div
          className="addr-row-sub"
          style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}
        >
          <style>{`@media (max-width: 620px) { .addr-row-sub { grid-template-columns: 1fr !important; } }`}</style>
          <Field label="City">
            <input style={fieldStyle()} value={org.city} onChange={(e) => update("city", e.target.value)} />
          </Field>
          <Field label="State / province">
            <input style={fieldStyle()} value={org.state} onChange={(e) => update("state", e.target.value)} />
          </Field>
          <Field label="ZIP / postal">
            <input
              style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".02em" }}
              value={org.zip}
              onChange={(e) => update("zip", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Country">
          <select style={fieldStyle()} value={org.country} onChange={(e) => update("country", e.target.value)}>
            <option>United States</option>
            <option>Canada</option>
            <option>Mexico</option>
          </select>
        </Field>
      </Panel>

      <Panel
        title="Service regions"
        subtitle="Where you're available for work. Helps GCs match you to new projects."
      >
        <Field label="Regions served">
          <ChipList
            options={REGION_OPTIONS as readonly string[]}
            selected={org.regions}
            onToggle={toggleRegion}
          />
        </Field>
        <FieldRow>
          <Field label="Typical crew size">
            <select style={fieldStyle()} value={org.crewSize} onChange={(e) => update("crewSize", e.target.value)}>
              {CREW_SIZE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <div />
        </FieldRow>
      </Panel>

      <Panel
        title="Primary contact"
        subtitle="The person GCs reach when they have questions or want to assign new work."
      >
        <FieldRow>
          <Field label="Contact name">
            <input style={fieldStyle()} value={org.primaryContactName} onChange={(e) => update("primaryContactName", e.target.value)} />
          </Field>
          <Field label="Title / role">
            <input style={fieldStyle()} value={org.primaryContactTitle} onChange={(e) => update("primaryContactTitle", e.target.value)} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Email">
            <input type="email" style={fieldStyle()} value={org.primaryContactEmail} onChange={(e) => update("primaryContactEmail", e.target.value)} />
          </Field>
          <Field label="Phone">
            <input type="tel" style={fieldStyle()} value={org.primaryContactPhone} onChange={(e) => update("primaryContactPhone", e.target.value)} />
          </Field>
        </FieldRow>
      </Panel>

      <Panel
        title="Licenses & credentials"
        subtitle="Trade licenses and state endorsements. GCs see these in your profile card."
        headerRight={
          <button style={btnGhostSm()}>
            <span style={{ marginRight: 4 }}>{I.plus}</span>Add license
          </button>
        }
      >
        {SUB_ORG_LICENSES.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: "var(--t3)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            No licenses added yet. GCs may ask for these when assigning work.
          </div>
        ) : (
          SUB_ORG_LICENSES.map((l) => (
            <div
              key={l.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: 14,
                border: "1px solid var(--s3)",
                borderRadius: 14,
                marginBottom: 8,
                background: "var(--s1)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    fontSize: 13.5,
                    fontWeight: 650,
                    letterSpacing: "-.01em",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {l.kind}
                  <Pill tone="accent">{l.state}</Pill>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--t3)",
                    marginTop: 3,
                    fontWeight: 500,
                    fontFamily: "'JetBrains Mono',monospace",
                  }}
                >
                  {l.number} · Expires {l.expires}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button style={btnGhostSm()}>Edit</button>
                <button style={{ ...btnGhostSm(), color: "var(--dg)" }} aria-label="Remove license">
                  {I.x}
                </button>
              </div>
            </div>
          ))
        )}
      </Panel>

      {(dirty || saved) && (
        <SaveBar
          state={saved ? "success" : "dirty"}
          message={saved ? "Company info saved" : "You have unsaved changes"}
          showActions={!saved}
          onDiscard={() => {
            setOrg(SUB_ORG_DEFAULTS);
            setDirty(false);
          }}
          onSave={() => {
            setDirty(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2400);
          }}
          saving={false}
        />
      )}
    </>
  );
}

function ChipList({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: 10,
        border: "1px solid var(--s3)",
        borderRadius: 10,
        background: "var(--s2)",
        minHeight: 44,
        alignItems: "center",
      }}
    >
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            style={{
              padding: "5px 10px 5px 12px",
              borderRadius: 999,
              background: on ? "var(--ac-s)" : "var(--s1)",
              border: `1px solid ${on ? "var(--ac-m)" : "var(--s3)"}`,
              fontSize: 12,
              fontWeight: 600,
              color: on ? "var(--ac-t)" : "var(--t2)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "all 120ms",
              cursor: "pointer",
              fontFamily: "'Instrument Sans',system-ui,sans-serif",
            }}
          >
            {o}
            {on && <span style={{ display: "inline-flex", opacity: 0.7 }}>{I.x}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ═══════ SUBCONTRACTOR: ORGANIZATION (LIVE) ═══════════════════════════
// Live variant. Shares the /api/org/profile + /api/org/licenses + logo
// routes with the contractor portal (they're portal-agnostic on the server
// side). Sub-specific fields (primary trade, secondary trades, regions, crew
// size) are surfaced here and not on the contractor tab.

type LiveSubOrgForm = {
  displayName: string;
  legalName: string;
  primaryTrade: string;
  secondaryTrades: string[];
  yearsInBusiness: string;
  taxId: string;
  website: string;
  phone: string;
  addr1: string;
  addr2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  crewSize: string;
  regions: string[];
  primaryContactName: string;
  primaryContactTitle: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
};

function subProfileToForm(p: OrganizationProfile): LiveSubOrgForm {
  return {
    displayName: p.displayName,
    legalName: p.legalName ?? "",
    primaryTrade: p.primaryTrade ?? "",
    secondaryTrades: p.secondaryTrades ?? [],
    yearsInBusiness: p.yearsInBusiness ?? "",
    taxId: p.taxId ?? "",
    website: p.website ?? "",
    phone: p.phone ?? "",
    addr1: p.addr1 ?? "",
    addr2: p.addr2 ?? "",
    city: p.city ?? "",
    stateRegion: p.stateRegion ?? "",
    postalCode: p.postalCode ?? "",
    country: p.country ?? "United States",
    crewSize: p.crewSize ?? "",
    regions: p.regions ?? [],
    primaryContactName: p.primaryContactName ?? "",
    primaryContactTitle: p.primaryContactTitle ?? "",
    primaryContactEmail: p.primaryContactEmail ?? "",
    primaryContactPhone: p.primaryContactPhone ?? "",
  };
}
// Maps form state onto the PATCH route's expected shape. Empty strings get
// coerced to null; arrays are passed through as-is (empty array = cleared).
function subFormToPatch(f: LiveSubOrgForm): Record<string, unknown> {
  return {
    displayName: f.displayName,
    legalName: f.legalName || null,
    primaryTrade: f.primaryTrade || null,
    secondaryTrades: f.secondaryTrades,
    yearsInBusiness: f.yearsInBusiness || null,
    taxId: f.taxId || null,
    website: f.website || null,
    phone: f.phone || null,
    addr1: f.addr1 || null,
    addr2: f.addr2 || null,
    city: f.city || null,
    stateRegion: f.stateRegion || null,
    postalCode: f.postalCode || null,
    country: f.country || null,
    crewSize: f.crewSize || null,
    regions: f.regions,
    primaryContactName: f.primaryContactName || null,
    primaryContactTitle: f.primaryContactTitle || null,
    primaryContactEmail: f.primaryContactEmail || null,
    primaryContactPhone: f.primaryContactPhone || null,
  };
}

function SubcontractorOrganizationLiveTab({
  subcontractor,
}: {
  subcontractor: SubcontractorSettingsBundle;
}) {
  const router = useRouter();
  const profile = subcontractor.orgProfile!;
  const licenses = subcontractor.orgLicenses ?? [];
  const canManage = subcontractor.role === "subcontractor_owner";

  const initialForm = subProfileToForm(profile);
  const [org, setOrg] = useState<LiveSubOrgForm>(initialForm);
  const [logoStorageKey, setLogoStorageKey] = useState<string | null>(
    profile.logoStorageKey,
  );
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    profile.logoPreviewUrl,
  );
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Logo upload
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  // License add/remove
  const [showAddLicense, setShowAddLicense] = useState(false);
  const [addingLicense, setAddingLicense] = useState(false);
  const [licenseForm, setLicenseForm] = useState({
    kind: "",
    licenseNumber: "",
    stateRegion: "",
    expiresOn: "",
  });
  const [licensePending, setLicensePending] = useState<Record<string, boolean>>({});
  const [licenseError, setLicenseError] = useState<string | null>(null);

  function update<K extends keyof LiveSubOrgForm>(k: K, v: LiveSubOrgForm[K]) {
    setOrg((p) => ({ ...p, [k]: v }));
    setDirty(true);
    setSaved(false);
    setError(null);
  }
  function toggleSecondary(t: string) {
    const has = org.secondaryTrades.includes(t);
    update(
      "secondaryTrades",
      has ? org.secondaryTrades.filter((x) => x !== t) : [...org.secondaryTrades, t],
    );
  }
  function toggleRegion(r: string) {
    const has = org.regions.includes(r);
    update(
      "regions",
      has ? org.regions.filter((x) => x !== r) : [...org.regions, r],
    );
  }

  const initials = (org.displayName || subcontractor.orgName)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/org/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subFormToPatch(org)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? body.error ?? "save_failed");
        return;
      }
      setDirty(false);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2400);
    } finally {
      setSaving(false);
    }
  }
  function discard() {
    setOrg(initialForm);
    setDirty(false);
    setError(null);
  }

  async function handleLogoUpload(file: File) {
    setLogoError(null);
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("File is larger than 2MB.");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/i.test(file.type)) {
      setLogoError("Only PNG, JPEG, WEBP, or SVG are allowed.");
      return;
    }
    setLogoUploading(true);
    try {
      const pre = await fetch("/api/org/logo/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!pre.ok) {
        const body = await pre.json().catch(() => ({}));
        setLogoError(body.message ?? body.error ?? "presign_failed");
        return;
      }
      const { uploadUrl, storageKey } = await pre.json();
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        setLogoError(`Upload failed (${put.status})`);
        return;
      }
      const fin = await fetch("/api/org/logo/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey }),
      });
      if (!fin.ok) {
        const body = await fin.json().catch(() => ({}));
        setLogoError(body.message ?? body.error ?? "finalize_failed");
        return;
      }
      const data = await fin.json();
      setLogoStorageKey(data.storageKey);
      setLogoPreviewUrl(data.previewUrl ?? null);
      router.refresh();
    } finally {
      setLogoUploading(false);
    }
  }
  async function handleLogoRemove() {
    setLogoError(null);
    setLogoUploading(true);
    try {
      const res = await fetch("/api/org/logo/finalize", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLogoError(body.message ?? body.error ?? "remove_failed");
        return;
      }
      setLogoStorageKey(null);
      setLogoPreviewUrl(null);
      router.refresh();
    } finally {
      setLogoUploading(false);
    }
  }

  async function addLicense() {
    if (!licenseForm.kind || !licenseForm.licenseNumber) return;
    setAddingLicense(true);
    setLicenseError(null);
    try {
      const res = await fetch("/api/org/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: licenseForm.kind,
          licenseNumber: licenseForm.licenseNumber,
          stateRegion: licenseForm.stateRegion || null,
          expiresOn: licenseForm.expiresOn || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLicenseError(body.message ?? body.error ?? "add_failed");
        return;
      }
      setLicenseForm({ kind: "", licenseNumber: "", stateRegion: "", expiresOn: "" });
      setShowAddLicense(false);
      router.refresh();
    } finally {
      setAddingLicense(false);
    }
  }
  async function removeLicense(id: string) {
    setLicensePending((p) => ({ ...p, [id]: true }));
    setLicenseError(null);
    try {
      const res = await fetch(`/api/org/licenses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLicenseError(body.message ?? body.error ?? "remove_failed");
        return;
      }
      router.refresh();
    } finally {
      setLicensePending((p) => ({ ...p, [id]: false }));
    }
  }

  return (
    <>
      <Panel
        title="Company logo"
        subtitle="Shown on certificates of insurance, pay applications, and in your GC's view."
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 14,
              background: logoPreviewUrl
                ? `url(${logoPreviewUrl}) center/cover no-repeat`
                : "linear-gradient(135deg,#1a2e3e,var(--ac))",
              color: "white",
              display: "grid",
              placeItems: "center",
              fontFamily: "'DM Sans',system-ui,sans-serif",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: "-.04em",
              flexShrink: 0,
            }}
          >
            {!logoPreviewUrl && initials}
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 8, fontWeight: 500 }}>
              PNG, JPEG, WEBP, or SVG · square, up to 2 MB · 512×512 recommended
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
                e.target.value = "";
              }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                style={btnGhostSm()}
                disabled={!canManage || logoUploading}
                onClick={() => logoInputRef.current?.click()}
              >
                {logoUploading ? "Uploading…" : (
                  <>
                    <span style={{ marginRight: 6 }}>{I.upload}</span>Upload logo
                  </>
                )}
              </button>
              {logoStorageKey && (
                <button
                  style={btnGhostSm()}
                  onClick={handleLogoRemove}
                  disabled={!canManage || logoUploading}
                >
                  Remove
                </button>
              )}
            </div>
            {logoError && (
              <div style={{ fontSize: 12, color: "var(--dg-t)", marginTop: 6, fontWeight: 520 }}>
                {logoError}
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title="Company information"
        subtitle="How your company appears to GCs and on official documents."
      >
        <FieldRow>
          <Field label="Display name" help="What GCs see in lists and assignments">
            <input
              style={fieldStyle()}
              value={org.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
          <Field label="Legal name" help="Used on invoices, W-9s, and contracts">
            <input
              style={fieldStyle()}
              value={org.legalName}
              onChange={(e) => update("legalName", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Primary trade" help="Your main scope — sets notification defaults">
            <select
              style={fieldStyle()}
              value={org.primaryTrade || "Electrical"}
              onChange={(e) => update("primaryTrade", e.target.value)}
              disabled={!canManage}
            >
              <option value="">—</option>
              {TRADE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Years in business">
            <input
              style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".02em" }}
              value={org.yearsInBusiness}
              onChange={(e) => update("yearsInBusiness", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
        </FieldRow>

        <Field
          label="Secondary trades (optional)"
          help="Trades you can also self-perform — used when GCs search for subs"
        >
          <ChipList
            options={TRADE_OPTIONS.filter((t) => t !== org.primaryTrade) as readonly string[]}
            selected={org.secondaryTrades}
            onToggle={canManage ? toggleSecondary : () => {}}
          />
        </Field>

        <FieldRow>
          <Field label="Tax ID (EIN)" help="Stored encrypted at the disk layer; admin-only access.">
            <input
              style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".02em" }}
              value={org.taxId}
              onChange={(e) => update("taxId", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
          <Field label="Website">
            <input
              type="url"
              style={fieldStyle()}
              value={org.website}
              onChange={(e) => update("website", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
        </FieldRow>
        <Field label="Main phone">
          <input
            type="tel"
            style={fieldStyle()}
            value={org.phone}
            onChange={(e) => update("phone", e.target.value)}
            readOnly={!canManage}
          />
        </Field>
      </Panel>

      <Panel
        title="Business address"
        subtitle="Used on W-9s, certificates of insurance, and official correspondence."
      >
        <Field label="Street address">
          <input style={fieldStyle()} value={org.addr1} onChange={(e) => update("addr1", e.target.value)} readOnly={!canManage} />
        </Field>
        <Field label="Suite / unit (optional)">
          <input style={fieldStyle()} value={org.addr2} onChange={(e) => update("addr2", e.target.value)} readOnly={!canManage} />
        </Field>
        <div
          className="sub-addr-row-live"
          style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}
        >
          <style>{`@media (max-width: 620px) { .sub-addr-row-live { grid-template-columns: 1fr !important; } }`}</style>
          <Field label="City">
            <input style={fieldStyle()} value={org.city} onChange={(e) => update("city", e.target.value)} readOnly={!canManage} />
          </Field>
          <Field label="State / province">
            <input style={fieldStyle()} value={org.stateRegion} onChange={(e) => update("stateRegion", e.target.value)} readOnly={!canManage} />
          </Field>
          <Field label="ZIP / postal">
            <input
              style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".02em" }}
              value={org.postalCode}
              onChange={(e) => update("postalCode", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
        </div>
        <Field label="Country">
          <select
            style={fieldStyle()}
            value={org.country || "United States"}
            onChange={(e) => update("country", e.target.value)}
            disabled={!canManage}
          >
            <option>United States</option>
            <option>Canada</option>
            <option>Mexico</option>
          </select>
        </Field>
      </Panel>

      <Panel
        title="Service regions"
        subtitle="Where you're available for work. Helps GCs match you to new projects."
      >
        <Field label="Regions served">
          <ChipList
            options={REGION_OPTIONS as readonly string[]}
            selected={org.regions}
            onToggle={canManage ? toggleRegion : () => {}}
          />
        </Field>
        <FieldRow>
          <Field label="Typical crew size">
            <select
              style={fieldStyle()}
              value={org.crewSize || "1–3"}
              onChange={(e) => update("crewSize", e.target.value)}
              disabled={!canManage}
            >
              <option value="">—</option>
              {CREW_SIZE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <div />
        </FieldRow>
      </Panel>

      <Panel
        title="Primary contact"
        subtitle="The person GCs reach when they have questions or want to assign new work."
      >
        <FieldRow>
          <Field label="Contact name">
            <input
              style={fieldStyle()}
              value={org.primaryContactName}
              onChange={(e) => update("primaryContactName", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
          <Field label="Title / role">
            <input
              style={fieldStyle()}
              value={org.primaryContactTitle}
              onChange={(e) => update("primaryContactTitle", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Email">
            <input
              type="email"
              style={fieldStyle()}
              value={org.primaryContactEmail}
              onChange={(e) => update("primaryContactEmail", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              style={fieldStyle()}
              value={org.primaryContactPhone}
              onChange={(e) => update("primaryContactPhone", e.target.value)}
              readOnly={!canManage}
            />
          </Field>
        </FieldRow>
      </Panel>

      <Panel
        title="Licenses & credentials"
        subtitle="Trade licenses and state endorsements. GCs see these in your profile card."
        headerRight={
          canManage ? (
            <button style={btnGhostSm()} onClick={() => setShowAddLicense((v) => !v)}>
              <span style={{ marginRight: 4 }}>{I.plus}</span>
              {showAddLicense ? "Cancel" : "Add license"}
            </button>
          ) : null
        }
      >
        {showAddLicense && canManage && (
          <div
            style={{
              background: "var(--ac-s)",
              border: "1px solid var(--ac-m)",
              borderRadius: 14,
              padding: 18,
              marginBottom: 12,
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
              gap: 10,
              alignItems: "end",
            }}
          >
            <Field label="License kind">
              <input
                placeholder="e.g. C-10 Electrical Contractor (CSLB)"
                style={fieldStyle()}
                value={licenseForm.kind}
                onChange={(e) => setLicenseForm({ ...licenseForm, kind: e.target.value })}
              />
            </Field>
            <Field label="License number">
              <input
                placeholder="C10-1048221"
                style={{ ...fieldStyle(), fontFamily: "'JetBrains Mono',monospace" }}
                value={licenseForm.licenseNumber}
                onChange={(e) => setLicenseForm({ ...licenseForm, licenseNumber: e.target.value })}
              />
            </Field>
            <Field label="State / region">
              <input
                placeholder="CA"
                style={fieldStyle()}
                value={licenseForm.stateRegion}
                onChange={(e) => setLicenseForm({ ...licenseForm, stateRegion: e.target.value })}
              />
            </Field>
            <Field label="Expires on">
              <input
                type="date"
                style={fieldStyle()}
                value={licenseForm.expiresOn}
                onChange={(e) => setLicenseForm({ ...licenseForm, expiresOn: e.target.value })}
              />
            </Field>
            <button
              style={btnPrimarySm(
                Boolean(licenseForm.kind && licenseForm.licenseNumber) && !addingLicense,
              )}
              onClick={addLicense}
              disabled={!licenseForm.kind || !licenseForm.licenseNumber || addingLicense}
            >
              {addingLicense ? "Adding…" : "Add"}
            </button>
          </div>
        )}

        {licenses.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: "var(--t3)",
              fontSize: 13,
              fontWeight: 500,
              border: "1px dashed var(--s3)",
              borderRadius: 12,
            }}
          >
            No licenses added yet. GCs may ask for these when assigning work.
          </div>
        ) : (
          licenses.map((l) => (
            <div
              key={l.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: 14,
                border: "1px solid var(--s3)",
                borderRadius: 14,
                marginBottom: 8,
                background: "var(--s1)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    fontSize: 13.5,
                    fontWeight: 650,
                    letterSpacing: "-.01em",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {l.kind}
                  {l.stateRegion && <Pill tone="accent">{l.stateRegion}</Pill>}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--t3)",
                    marginTop: 3,
                    fontWeight: 500,
                    fontFamily: "'JetBrains Mono',monospace",
                  }}
                >
                  {l.licenseNumber}
                  {l.expiresOn && <> · Expires {l.expiresOn}</>}
                </div>
              </div>
              {canManage && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    style={{ ...btnGhostSm(), color: "var(--dg)" }}
                    onClick={() => removeLicense(l.id)}
                    aria-label="Remove license"
                    disabled={licensePending[l.id]}
                  >
                    {licensePending[l.id] ? "…" : I.x}
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {licenseError && (
          <div
            style={{
              background: "var(--dg-s)",
              border: "1px solid var(--dg)",
              borderRadius: 12,
              padding: "10px 14px",
              marginTop: 10,
              fontSize: 12.5,
              color: "var(--dg-t)",
              fontWeight: 580,
            }}
          >
            {licenseError}
          </div>
        )}
      </Panel>

      {(dirty || saved || error) && (
        <SaveBar
          state={error ? "dirty" : saved ? "success" : "dirty"}
          message={
            error
              ? error
              : saved
                ? "Company info saved"
                : "You have unsaved changes"
          }
          showActions={!saved && !error}
          onDiscard={discard}
          onSave={save}
          saving={saving}
        />
      )}
    </>
  );
}

// ═══════ SUBCONTRACTOR: TRADE & COMPLIANCE TAB ═════════════════════════
type ComplianceDoc = {
  id: string;
  kind: string;
  status: "current" | "expiring" | "expired" | "missing" | "na";
  expires: string;
  detail: string;
  carrier?: string;
};
const SUB_COMPLIANCE_DOCS: ComplianceDoc[] = [
  { id: "gl", kind: "General Liability Insurance", status: "current", expires: "Jun 14, 2027", detail: "$2M per occurrence · $4M aggregate", carrier: "Travelers" },
  { id: "wc", kind: "Workers' Compensation", status: "current", expires: "Feb 28, 2027", detail: "Coverage: California statutory", carrier: "State Fund" },
  { id: "al", kind: "Auto Liability", status: "expiring", expires: "Sep 3, 2026", detail: "$1M combined single limit · 4 vehicles listed", carrier: "Progressive Commercial" },
  { id: "w9", kind: "W-9 Tax Form", status: "current", expires: "—", detail: "Filed Jan 8, 2025 · On file with Summit Contracting" },
  { id: "ein", kind: "EIN Verification", status: "current", expires: "—", detail: "IRS CP-575 on file" },
  { id: "bond", kind: "Surety Bond", status: "na", expires: "—", detail: "Not required for current assigned projects" },
  { id: "msa", kind: "Master Services Agreement", status: "current", expires: "Dec 31, 2026", detail: "Signed with Summit Contracting · Jan 2024" },
];

type SubCertification = {
  id: number;
  kind: string;
  holder: string;
  issued: string;
  expires: string;
};
// compliance_type on the DB side is a free-form varchar. Try to render it
// nicely: convert snake_case / kebab-case to Title Case, leave already-nicely-
// cased strings alone. Handles "general_liability" → "General liability".
function humanizeComplianceType(raw: string): string {
  if (!raw) return "Unknown";
  if (/^[A-Z]/.test(raw) && /\s/.test(raw)) return raw; // already humanized
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(\w)/, (c) => c.toUpperCase());
}

const SUB_CERTS_DEFAULTS: SubCertification[] = [
  { id: 1, kind: "OSHA-30 Construction", holder: "Alex Morales", issued: "Mar 2024", expires: "Mar 2029" },
  { id: 2, kind: "OSHA-10 Construction", holder: "4 crew members", issued: "Various", expires: "Multiple" },
  { id: 3, kind: "NFPA 70E Arc Flash", holder: "Alex Morales, R. Chen", issued: "Aug 2025", expires: "Aug 2028" },
  { id: 4, kind: "NECA Member (Northern CA)", holder: "Northline Electrical", issued: "2018", expires: "Annual renewal" },
];

function SubcontractorComplianceTab({
  subcontractor,
}: {
  subcontractor?: SubcontractorSettingsBundle;
}) {
  const router = useRouter();
  // Live-mode gate: we have a sub bundle AND an orgProfile for it.
  const liveProfile = subcontractor?.orgProfile ?? null;
  const liveCerts = subcontractor?.orgCertifications ?? null;
  const canManage = subcontractor?.role === "subcontractor_owner";

  // Sample-mode cert state — only used when liveCerts isn't available. The
  // setCerts path never fires in live mode; mutations go through the API.
  const [sampleCerts, setSampleCerts] = useState<SubCertification[]>(
    SUB_CERTS_DEFAULTS,
  );
  const [showAddCert, setShowAddCert] = useState(false);
  const [form, setForm] = useState({ kind: "", holder: "", issued: "", expires: "" });

  // Live-mode cert mutation state
  const [addingCert, setAddingCert] = useState(false);
  const [certPending, setCertPending] = useState<Record<string, boolean>>({});
  const [certError, setCertError] = useState<string | null>(null);

  async function addCert() {
    if (!form.kind) return;
    if (liveCerts) {
      setAddingCert(true);
      setCertError(null);
      try {
        const res = await fetch("/api/org/certifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: form.kind,
            holder: form.holder || null,
            issuedOn: form.issued || null,
            expiresOn: form.expires || null,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setCertError(body.message ?? body.error ?? "add_failed");
          return;
        }
        setForm({ kind: "", holder: "", issued: "", expires: "" });
        setShowAddCert(false);
        router.refresh();
      } finally {
        setAddingCert(false);
      }
    } else {
      setSampleCerts((prev) => [...prev, { id: Date.now(), ...form }]);
      setForm({ kind: "", holder: "", issued: "", expires: "" });
      setShowAddCert(false);
    }
  }

  async function removeCert(id: string | number) {
    if (liveCerts) {
      const key = String(id);
      setCertPending((p) => ({ ...p, [key]: true }));
      setCertError(null);
      try {
        const res = await fetch(`/api/org/certifications/${key}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setCertError(body.message ?? body.error ?? "remove_failed");
          return;
        }
        router.refresh();
      } finally {
        setCertPending((p) => ({ ...p, [key]: false }));
      }
    } else {
      setSampleCerts((prev) => prev.filter((c) => c.id !== id));
    }
  }

  const statusTone: Record<ComplianceDoc["status"], PillTone | undefined> = {
    current: "ok",
    expiring: "warn",
    expired: "danger",
    missing: "danger",
    na: undefined,
  };
  const statusLabel: Record<ComplianceDoc["status"], string> = {
    current: "Current",
    expiring: "Expiring soon",
    expired: "Expired",
    missing: "Missing",
    na: "Not applicable",
  };

  // When the sub bundle is present, use real compliance records from the DB
  // (projected into the same shape the UI renders). Fall back to the sample
  // list when no bundle is available (e.g. an unassigned user mid-onboarding).
  const liveCompliance = subcontractor?.compliance ?? null;
  const complianceRows: ComplianceDoc[] = liveCompliance
    ? liveCompliance.map((r) => {
        // metadata_json gives us real carrier + coverage strings; when those
        // aren't populated yet, fall back to the document title so the row
        // still has something readable in the detail column.
        const detail =
          r.detail ?? r.coverage ?? r.documentFilename ?? "—";
        return {
          id: r.id,
          kind: humanizeComplianceType(r.complianceType),
          status: r.status,
          expires: r.expiresLabel,
          detail,
          carrier: r.carrier ?? undefined,
        };
      })
    : SUB_COMPLIANCE_DOCS;

  // Trade summary values. Pull from live org profile when we have one; fall
  // back to the sample org defaults otherwise.
  const summaryPrimaryTrade = liveProfile?.primaryTrade ?? SUB_ORG_DEFAULTS.primaryTrade;
  const summaryCrewSize = liveProfile?.crewSize ?? SUB_ORG_DEFAULTS.crewSize;
  const summarySecondaryTrades =
    liveProfile?.secondaryTrades ?? SUB_ORG_DEFAULTS.secondaryTrades;
  const summaryRegions = liveProfile?.regions ?? SUB_ORG_DEFAULTS.regions;

  // Certifications list. Live mode: from the bundle, id is a UUID string.
  // Sample mode: local state, id is a numeric timestamp.
  const certRows: Array<{
    id: string | number;
    kind: string;
    holder: string | null;
    issuedOn: string | null;
    expiresOn: string | null;
  }> = liveCerts
    ? liveCerts.map((c) => ({
        id: c.id,
        kind: c.kind,
        holder: c.holder,
        issuedOn: c.issuedOn,
        expiresOn: c.expiresOn,
      }))
    : sampleCerts.map((c) => ({
        id: c.id,
        kind: c.kind,
        holder: c.holder,
        issuedOn: c.issued,
        expiresOn: c.expires,
      }));

  // In live mode, certifications add/remove actions require org-owner role.
  // Sample mode has no auth gate — anyone can edit the demo list.
  const certsWritable = liveCerts ? Boolean(canManage) : true;

  return (
    <>
      <Panel
        title="Trade summary"
        subtitle="Snapshot of your trade profile. Edit details in the Organization tab."
      >
        <div
          className="sub-summary-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: -4,
          }}
        >
          <style>{`@media (max-width: 620px) { .sub-summary-grid { grid-template-columns: 1fr !important; } }`}</style>
          <SummaryItem
            label="Primary trade"
            value={summaryPrimaryTrade || "Not set"}
          />
          <SummaryItem
            label="Crew size"
            value={summaryCrewSize ? `${summaryCrewSize} on typical job` : "Not set"}
          />
          <SummaryItem
            label="Secondary trades"
            value={
              summarySecondaryTrades && summarySecondaryTrades.length > 0
                ? summarySecondaryTrades.join(" · ")
                : "None"
            }
            fullWidth
            valueBody
          />
          <SummaryItem
            label="Service regions"
            value={
              summaryRegions && summaryRegions.length > 0
                ? summaryRegions.join(" · ")
                : "None"
            }
            fullWidth
            valueBody
          />
        </div>
      </Panel>

      <Panel
        title="Compliance snapshot"
        subtitle="Live status of your compliance documents. Uploads and renewals happen in the Compliance workspace."
        headerRight={
          <button style={btnGhostSm()}>
            Open Compliance
            <span style={{ marginLeft: 4 }}>{I.link}</span>
          </button>
        }
      >
        <div
          style={{
            background: "var(--ac-s)",
            border: "1px solid var(--ac-m)",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "var(--ac)",
              color: "white",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            {I.shield}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                fontFamily: "'DM Sans',system-ui,sans-serif",
                fontSize: 13.5,
                fontWeight: 650,
                color: "var(--ac-t)",
              }}
            >
              Read-only view
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--ac-t)",
                marginTop: 2,
                fontWeight: 520,
                opacity: 0.9,
              }}
            >
              This snapshot mirrors your compliance record. To upload new documents or renew
              expiring ones, open the Compliance workspace.
            </div>
          </div>
        </div>

        {complianceRows.length === 0 && (
          <div
            style={{
              padding: 20,
              border: "1px dashed var(--s3)",
              borderRadius: 12,
              textAlign: "center",
              color: "var(--t3)",
              fontSize: 13,
              fontWeight: 520,
            }}
          >
            No compliance records yet. Open the Compliance workspace to upload your first
            document.
          </div>
        )}

        {complianceRows.map((d) => (
          <div
            key={d.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              padding: 14,
              border: "1px solid var(--s3)",
              borderRadius: 14,
              marginBottom: 8,
              background: "var(--s1)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  fontSize: 13.5,
                  fontWeight: 650,
                  letterSpacing: "-.01em",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {d.kind}
                <Pill tone={statusTone[d.status]}>{statusLabel[d.status]}</Pill>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--t3)",
                  marginTop: 3,
                  fontWeight: 500,
                  lineHeight: 1.45,
                }}
              >
                {d.detail}
                {d.carrier && (
                  <>
                    {" "}
                    ·{" "}
                    <span
                      style={{
                        fontFamily: "'DM Sans',system-ui,sans-serif",
                        fontWeight: 600,
                        color: "var(--t2)",
                      }}
                    >
                      {d.carrier}
                    </span>
                  </>
                )}
                {d.expires !== "—" && <> · Expires {d.expires}</>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button style={btnGhostSm()}>View</button>
            </div>
          </div>
        ))}
      </Panel>

      <Panel
        title="Certifications"
        subtitle="Self-managed — training, industry memberships, and endorsements. Not required for GC onboarding, but shown in your profile."
        headerRight={
          certsWritable ? (
            <button
              style={btnPrimarySm(true)}
              onClick={() => setShowAddCert((v) => !v)}
            >
              {showAddCert ? "Cancel" : (
                <>
                  <span style={{ marginRight: 4 }}>{I.plus}</span>Add certification
                </>
              )}
            </button>
          ) : null
        }
      >
        {showAddCert && certsWritable && (
          <div
            style={{
              background: "var(--ac-s)",
              border: "1px solid var(--ac-m)",
              borderRadius: 14,
              padding: 18,
              marginBottom: 12,
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr auto",
              gap: 10,
              alignItems: "end",
            }}
            className="cert-add-grid"
          >
            <style>{`
              @media (max-width: 820px) { .cert-add-grid { grid-template-columns: 1fr 1fr !important; } }
              @media (max-width: 520px) { .cert-add-grid { grid-template-columns: 1fr !important; } }
            `}</style>
            <Field label="Certification / credential">
              <input
                placeholder="e.g. OSHA-30 Construction"
                style={fieldStyle()}
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              />
            </Field>
            <Field label="Holder">
              <input
                placeholder="Name or 'Company'"
                style={fieldStyle()}
                value={form.holder}
                onChange={(e) => setForm({ ...form, holder: e.target.value })}
              />
            </Field>
            <Field label="Expires">
              <input
                placeholder="Month YYYY"
                style={fieldStyle()}
                value={form.expires}
                onChange={(e) => setForm({ ...form, expires: e.target.value })}
              />
            </Field>
            <button
              style={btnPrimarySm(Boolean(form.kind) && !addingCert)}
              onClick={addCert}
              disabled={!form.kind || addingCert}
            >
              {addingCert ? "Adding…" : "Add"}
            </button>
          </div>
        )}

        {certRows.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "var(--t3)",
              fontSize: 13,
              fontWeight: 500,
              border: "1px dashed var(--s3)",
              borderRadius: 12,
            }}
          >
            No certifications added yet.
          </div>
        ) : (
          certRows.map((c) => {
            const pendingKey = String(c.id);
            return (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: 14,
                  border: "1px solid var(--s3)",
                  borderRadius: 14,
                  marginBottom: 8,
                  background: "var(--s1)",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "var(--ac-s)",
                    color: "var(--ac-t)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {I.sparkle}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "'DM Sans',system-ui,sans-serif",
                      fontSize: 13.5,
                      fontWeight: 650,
                      letterSpacing: "-.01em",
                    }}
                  >
                    {c.kind}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--t3)",
                      marginTop: 3,
                      fontWeight: 500,
                      lineHeight: 1.45,
                    }}
                  >
                    {c.holder ?? "—"}
                    {c.issuedOn && <> · Issued {c.issuedOn}</>}
                    {c.expiresOn && <> · Expires {c.expiresOn}</>}
                  </div>
                </div>
                {certsWritable && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      style={{ ...btnGhostSm(), color: "var(--dg)" }}
                      onClick={() => removeCert(c.id)}
                      aria-label="Remove certification"
                      disabled={certPending[pendingKey]}
                    >
                      {certPending[pendingKey] ? "…" : I.x}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {certError && (
          <div
            style={{
              background: "var(--dg-s)",
              border: "1px solid var(--dg)",
              borderRadius: 12,
              padding: "10px 14px",
              marginTop: 10,
              fontSize: 12.5,
              color: "var(--dg-t)",
              fontWeight: 580,
            }}
          >
            {certError}
          </div>
        )}
      </Panel>
    </>
  );
}

function SummaryItem({
  label,
  value,
  fullWidth,
  valueBody,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
  valueBody?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--s2)",
        borderRadius: 10,
        gridColumn: fullWidth ? "1 / -1" : undefined,
      }}
    >
      <div
        style={{
          fontFamily: "'DM Sans',system-ui,sans-serif",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--t3)",
          textTransform: "uppercase",
          letterSpacing: ".05em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: valueBody
            ? "'Instrument Sans',system-ui,sans-serif"
            : "'DM Sans',system-ui,sans-serif",
          fontSize: valueBody ? 13 : 13.5,
          fontWeight: valueBody ? 550 : 600,
          color: "var(--t1)",
          letterSpacing: "-.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// Suppress unused import warnings in environments that tree-shake differently.
export type { TabId };
export { roleLabelFor };
