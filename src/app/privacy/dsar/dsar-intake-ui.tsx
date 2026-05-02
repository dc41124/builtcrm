"use client";

// Step 65 Session B — public DSAR intake form.
//
// Reskinned to the marketing aesthetic (cream bg, dark purple) per
// docs/specs/dsar_link_placement_guide.md §5. The intake form in
// builtcrm_privacy_officer_law25_paired.jsx (View 02) was originally
// portal-themed; we reuse its content but shift the palette to match
// /privacy and /privacy/officer.
//
// Cloudflare Turnstile widget is loaded only when the public site key
// is configured; otherwise (dev) we fall back to a manual "I'm not a
// robot" checkbox and the server-side helper bypasses verification.

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { PrivacyShell } from "@/components/privacy/privacy-shell";
import { PRIVACY_F } from "@/components/privacy/privacy-tokens";
import { PUBLIC_PRIVACY_OFFICER } from "@/lib/privacy/public-content";

type RequestType = "access" | "deletion" | "rectification" | "portability";
type Province = "QC" | "ON" | "BC" | "AB" | "OTHER";

const REQUEST_TYPES: { id: RequestType; ti: string; desc: string }[] = [
  { id: "access", ti: "Access", desc: "Receive a copy of personal data we hold about you, in a readable format." },
  { id: "deletion", ti: "Deletion", desc: "Have your personal data removed, subject to legal retention requirements." },
  { id: "rectification", ti: "Rectification", desc: "Correct inaccurate or incomplete personal data we hold about you." },
  { id: "portability", ti: "Portability", desc: "Receive a structured, machine-readable export to transfer to another service." },
];

type FormState = {
  name: string;
  email: string;
  accountEmail: string;
  province: Province;
  requestType: RequestType;
  description: string;
  agreeIdentity: boolean;
  manualCaptcha: boolean; // dev fallback only
};

const INITIAL: FormState = {
  name: "",
  email: "",
  accountEmail: "",
  province: "QC",
  requestType: "access",
  description: "",
  agreeIdentity: false,
  manualCaptcha: false,
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: string | HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

export function DsarIntakeUI({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ referenceCode: string } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const widgetMounted = useRef(false);

  // Render the Turnstile widget once the script loads. We poll briefly
  // because the script is loaded `afterInteractive` and React's commit
  // can race the global being defined.
  useEffect(() => {
    if (!turnstileSiteKey || widgetMounted.current) return;
    let cancelled = false;
    let attempts = 0;
    const tick = () => {
      if (cancelled) return;
      if (window.turnstile) {
        widgetMounted.current = true;
        window.turnstile.render("#dsar-turnstile", {
          sitekey: turnstileSiteKey,
          callback: (token: string) => setTurnstileToken(token),
          "error-callback": () => setTurnstileToken(null),
          "expired-callback": () => setTurnstileToken(null),
          theme: "light",
        });
        return;
      }
      attempts += 1;
      if (attempts < 40) setTimeout(tick, 100);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [turnstileSiteKey]);

  const captchaPassed = turnstileSiteKey ? !!turnstileToken : form.manualCaptcha;
  const canSubmit =
    !!form.name.trim() &&
    !!form.email.trim() &&
    form.description.trim().length >= 10 &&
    form.agreeIdentity &&
    captchaPassed &&
    !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy/dsar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          accountEmail: form.accountEmail.trim() || undefined,
          province: form.province,
          requestType: form.requestType,
          description: form.description.trim(),
          agreeIdentity: form.agreeIdentity,
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(
          json?.message ??
            (res.status === 429
              ? "Too many submissions. Please try again later."
              : "We couldn't submit your request. Please try again."),
        );
        // Reset Turnstile so the user can re-attest if the issue was captcha.
        if (turnstileSiteKey && window.turnstile) {
          try {
            window.turnstile.reset();
          } catch {
            /* ignore */
          }
          setTurnstileToken(null);
        }
        return;
      }
      setSuccess({ referenceCode: json.referenceCode as string });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PrivacyShell active="dsar" breadcrumbLabel="Submit a request">
      {turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
        />
      )}

      <div style={{ background: "linear-gradient(180deg,#fff 0%,#faf9f7 100%)", borderBottom: "1px solid #eeece8", padding: "48px 32px 36px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontFamily: PRIVACY_F.display,
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: ".07em",
              textTransform: "uppercase",
              color: "#4a3fb0",
              background: "#eeedfb",
              padding: "5px 12px",
              borderRadius: 999,
              marginBottom: 14,
            }}
          >
            <ShieldIcon /> Quebec Law 25 · DSAR
          </span>
          <h1 style={{ fontFamily: PRIVACY_F.display, fontSize: 36, fontWeight: 820, letterSpacing: "-.03em", lineHeight: 1.1, margin: "8px 0 12px", maxWidth: 720, color: "#1a1714" }}>
            Submit a privacy request
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "#5a5249", maxWidth: 640, margin: 0 }}>
            Under Quebec&apos;s Law 25 and similar regulations elsewhere, you can request access to,
            correction of, deletion of, or a portable copy of personal data we hold about you. We
            respond within <strong>30 days</strong>.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 32px 80px", display: "grid", gridTemplateColumns: "1.55fr .85fr", gap: 32 }}>
        {success ? (
          <SuccessCard referenceCode={success.referenceCode} email={form.email} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) handleSubmit();
            }}
            style={{ background: "#fff", border: "1px solid #eeece8", borderRadius: 20, padding: 26 }}
          >
            <h3 style={{ fontFamily: PRIVACY_F.display, fontSize: 14, fontWeight: 680, color: "#1a1714", letterSpacing: "-.005em", marginTop: 0, marginBottom: 14 }}>Your identity</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <Field label="Full name" required>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Marie Lefèvre"
                  style={inputStyle}
                />
              </Field>
              <Field label="Contact email" required>
                <input
                  type="email"
                  required
                  maxLength={320}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
              <Field label="Account email" hint="(if different)">
                <input
                  type="email"
                  maxLength={320}
                  value={form.accountEmail}
                  onChange={(e) => setForm({ ...form, accountEmail: e.target.value })}
                  placeholder="If you held a BuiltCRM account under a different email"
                  style={inputStyle}
                />
              </Field>
              <Field label="Province / region">
                <select
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value as Province })}
                  style={inputStyle}
                >
                  <option value="QC">Quebec (Law 25)</option>
                  <option value="ON">Ontario (PIPEDA)</option>
                  <option value="BC">British Columbia (PIPA)</option>
                  <option value="AB">Alberta (PIPA)</option>
                  <option value="OTHER">Other / outside Canada</option>
                </select>
              </Field>
            </div>

            <h3 style={{ fontFamily: PRIVACY_F.display, fontSize: 14, fontWeight: 680, color: "#1a1714", letterSpacing: "-.005em", marginBottom: 12 }}>What kind of request?</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
              {REQUEST_TYPES.map((t) => {
                const cur = form.requestType === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setForm({ ...form, requestType: t.id })}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      border: `1.5px solid ${cur ? "#5b4fc7" : "#e3dfd8"}`,
                      borderRadius: 10,
                      padding: "13px 14px",
                      background: cur ? "#eeedfb" : "#fff",
                      transition: "all 120ms",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                      <div style={{ fontFamily: PRIVACY_F.display, fontSize: 13.5, fontWeight: 680, color: "#1a1714" }}>{t.ti}</div>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: `2px solid ${cur ? "#5b4fc7" : "#cdc7be"}`,
                          background: cur ? "#5b4fc7" : "transparent",
                          position: "relative",
                          flexShrink: 0,
                        }}
                      >
                        {cur && (
                          <span
                            style={{
                              position: "absolute",
                              inset: 3,
                              borderRadius: "50%",
                              background: "#fff",
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#5a5249", lineHeight: 1.5 }}>{t.desc}</div>
                  </button>
                );
              })}
            </div>

            <Field label="Description of your request" required hint="The more specific (project name, timeframe, type of data), the faster we can respond.">
              <textarea
                required
                minLength={10}
                maxLength={4000}
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Tell us what you're looking for."
                style={{ ...inputStyle, resize: "vertical", minHeight: 90, fontFamily: PRIVACY_F.body }}
              />
              <div style={{ fontSize: 12, color: "#8b837a", marginTop: 4 }}>
                If your request is broad, we may ask for clarification — the 30-day clock pauses once for a single clarification request.
              </div>
            </Field>

            {/* Captcha */}
            <div style={{ marginTop: 18 }}>
              {turnstileSiteKey ? (
                <div id="dsar-turnstile" />
              ) : (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    border: "1.5px dashed #cdc7be",
                    borderRadius: 10,
                    padding: 18,
                    background: "#f3efea",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.manualCaptcha}
                    onChange={(e) => setForm({ ...form, manualCaptcha: e.target.checked })}
                    style={{ width: 22, height: 22 }}
                  />
                  <span style={{ fontFamily: PRIVACY_F.display, fontSize: 13, fontWeight: 600, color: "#1a1714" }}>
                    I&apos;m not a robot
                  </span>
                  <span style={{ fontSize: 11.5, color: "#8b837a", fontFamily: PRIVACY_F.mono, marginLeft: "auto" }}>
                    dev placeholder
                  </span>
                </label>
              )}
            </div>

            {/* Identity attestation */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                margin: "18px 0 22px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={form.agreeIdentity}
                onChange={(e) => setForm({ ...form, agreeIdentity: e.target.checked })}
                style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: "#5a5249", lineHeight: 1.55 }}>
                I confirm I am the person whose data is being requested, or I am the legal representative authorized to make this request. I understand BuiltCRM may ask for additional identity verification before fulfilling the request.
              </span>
            </label>

            {error && (
              <div style={{ background: "#fdeaea", border: "1px solid #f0b8b8", borderRadius: 10, padding: "12px 14px", color: "#a52e2e", fontSize: 13.5, marginBottom: 14 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: "100%",
                background: canSubmit ? "#5b4fc7" : "#cdc7be",
                color: "#fff",
                border: "none",
                fontFamily: PRIVACY_F.display,
                fontSize: 14,
                fontWeight: 680,
                padding: "12px 22px",
                borderRadius: 8,
                cursor: canSubmit ? "pointer" : "not-allowed",
                transition: "all 120ms",
              }}
            >
              {submitting ? "Submitting…" : "Submit request"}
            </button>
          </form>
        )}

        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SideCard title="What happens next" icon={<ClockIcon />}>
            <ol style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, lineHeight: 1.55, color: "#5a5249" }}>
              <li>You&apos;ll get a confirmation email with a reference number.</li>
              <li>Our Privacy Officer reviews and may request identity verification.</li>
              <li>We respond within <strong>30 days</strong> with the request fulfilled or an explanation.</li>
              <li>Complex requests may be extended once by 30 days with notice.</li>
            </ol>
          </SideCard>

          <SideCard title="Privacy Officer" icon={<UserIcon />}>
            <div style={{ fontFamily: PRIVACY_F.display, fontSize: 13.5, fontWeight: 680, color: "#1a1714", marginBottom: 2 }}>
              {PUBLIC_PRIVACY_OFFICER.name}
            </div>
            <div style={{ fontSize: 12, color: "#5a5249", marginBottom: 8 }}>
              {PUBLIC_PRIVACY_OFFICER.role}
            </div>
            <div style={{ fontFamily: PRIVACY_F.mono, fontSize: 12, color: "#5a5249" }}>
              {PUBLIC_PRIVACY_OFFICER.email}
            </div>
            <div style={{ fontSize: 12, color: "#8b837a", lineHeight: 1.55, marginTop: 8 }}>
              Not satisfied with our response? You may file a complaint with the{" "}
              <a href="https://www.cai.gouv.qc.ca" target="_blank" rel="noopener noreferrer" style={{ color: "#4a3fb0" }}>
                Commission d&apos;accès à l&apos;information
              </a>{" "}
              at any time.
            </div>
          </SideCard>

          <SideCard title="Your privacy" icon={<LockIcon />}>
            <div style={{ fontSize: 12, color: "#5a5249", lineHeight: 1.55 }}>
              Information you submit through this form is encrypted in transit and stored only as
              long as needed to process your request — typically 90 days after closure. See{" "}
              <Link href="/privacy" style={{ color: "#4a3fb0", textDecoration: "none" }}>
                our Privacy Policy
              </Link>{" "}
              for details.
            </div>
          </SideCard>
        </aside>
      </div>
    </PrivacyShell>
  );
}

const inputStyle: React.CSSProperties = {
  fontFamily: PRIVACY_F.body,
  fontSize: 13.5,
  color: "#1a1714",
  border: "1px solid #e3dfd8",
  background: "#fff",
  borderRadius: 6,
  padding: "9px 12px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontFamily: PRIVACY_F.display, fontSize: 12, fontWeight: 620, color: "#1a1714", letterSpacing: "-.005em" }}>
        {label}
        {required && <span style={{ color: "#c93b3b", marginLeft: 3 }}>*</span>}
        {hint && (
          <span style={{ fontSize: 12, color: "#8b837a", fontWeight: 480, marginLeft: 6 }}>
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function SideCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #eeece8", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ fontFamily: PRIVACY_F.display, fontSize: 13, fontWeight: 700, color: "#1a1714", letterSpacing: "-.005em", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function SuccessCard({ referenceCode, email }: { referenceCode: string; email: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #eeece8", borderRadius: 20, padding: "42px 32px", textAlign: "center" }}>
      <div style={{ display: "inline-flex", width: 64, height: 64, borderRadius: "50%", background: "#edf7f1", color: "#1e6b46", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <CheckCircleLg />
      </div>
      <h2 style={{ fontFamily: PRIVACY_F.display, fontSize: 24, fontWeight: 780, color: "#1a1714", letterSpacing: "-.02em", marginBottom: 10 }}>
        Request submitted
      </h2>
      <p style={{ fontSize: 14, color: "#5a5249", lineHeight: 1.55, marginBottom: 6 }}>
        We&apos;ve received your request and sent a confirmation to <strong>{email}</strong>.
      </p>
      <p style={{ fontSize: 14, color: "#5a5249", lineHeight: 1.55, marginBottom: 6 }}>
        Our Privacy Officer will respond within 30 days.
      </p>
      <div style={{ fontFamily: PRIVACY_F.mono, fontSize: 12.5, color: "#1a1714", background: "#f3efea", padding: "8px 14px", borderRadius: 6, display: "inline-block", marginTop: 14 }}>
        Reference: {referenceCode}
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function CheckCircleLg() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
