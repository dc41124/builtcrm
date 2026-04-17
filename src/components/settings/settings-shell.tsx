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
};

// ── Tab descriptor ──────────────────────────────────────────────────────
type TabId =
  | "profile"
  | "security"
  | "notifications"
  | "appearance"
  | "integrations"
  | "payments";
type TabDescriptor = { id: TabId; label: string; desc: string; icon: ReactNode };
const BASE_TABS: TabDescriptor[] = [
  { id: "profile", label: "Profile", icon: I.user, desc: "Name, contact info, and how you appear to others" },
  { id: "security", label: "Security", icon: I.shield, desc: "Password, two-factor authentication, and active sessions" },
  { id: "notifications", label: "Notifications", icon: I.bellOutline, desc: "What you hear about and how you hear about it" },
  { id: "appearance", label: "Appearance", icon: I.sparkle, desc: "Theme, language, and display preferences" },
];
const CONTRACTOR_TABS: TabDescriptor[] = [
  { id: "integrations", label: "Integrations", icon: I.link, desc: "Accounting, calendar, and productivity tools" },
  { id: "payments", label: "Payments", icon: I.card, desc: "Stripe Connect, payouts, and payment history" },
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
}: {
  view: UserSettingsView;
  showDangerZone?: boolean;
}) {
  const [tab, setTab] = useState<TabId>("profile");
  const tabs: TabDescriptor[] =
    view.portalType === "contractor"
      ? [...BASE_TABS, ...CONTRACTOR_TABS]
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
        {tab === "integrations" && <ContractorIntegrationsTab />}
        {tab === "payments" && <ContractorPaymentsTab />}
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

function ContractorIntegrationsTab() {
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

function ContractorPaymentsTab() {
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

// Suppress unused import warnings in environments that tree-shake differently.
export type { TabId };
export { roleLabelFor };
