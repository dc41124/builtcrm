"use client";

import { useState } from "react";

import { signUp } from "@/auth/client";

type Step = "account" | "plan";
type Cycle = "monthly" | "annual";

type Tier = {
  slug: "starter" | "professional" | "enterprise";
  name: string;
  monthly: number | null;
  annual: number | null;
  blurb: string;
  featured?: boolean;
  bullets: readonly string[];
};

// Hard-coded tier catalog for the signup surface. The server source of truth
// lives in subscription_plans; the signup page only displays the 3 canonical
// tiers and submits by slug — it doesn't need a live DB read to render.
const TIERS: readonly Tier[] = [
  {
    slug: "starter",
    name: "Starter",
    monthly: 149,
    annual: 119,
    blurb: "Solo GC or small crew, handful of projects.",
    bullets: ["5 active projects", "3 team members", "5 GB storage"],
  },
  {
    slug: "professional",
    name: "Professional",
    monthly: 399,
    annual: 319,
    blurb: "Growing teams with multiple projects.",
    featured: true,
    bullets: [
      "Unlimited projects",
      "10 team members",
      "50 GB storage",
      "Everything in Starter",
    ],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    monthly: null,
    annual: null,
    blurb: "Custom workflows, integrations, and dedicated support.",
    bullets: [
      "Unlimited everything",
      "SSO / SAML",
      "Dedicated account manager",
    ],
  },
];

export function ContractorSignupFlow() {
  const [step, setStep] = useState<Step>("account");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [billingCycle, setBillingCycle] = useState<Cycle>("annual");
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  // Account form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");

  async function onAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const displayName = `${firstName} ${lastName}`.trim();
    const signupRes = await signUp.email({
      email,
      password,
      name: displayName || email,
    });
    if (signupRes.error) {
      setSubmitting(false);
      setError(
        signupRes.error.message ??
          "Could not create account. Try signing in instead.",
      );
      return;
    }

    const bootstrapRes = await fetch("/api/signup/contractor-bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName }),
    });
    setSubmitting(false);
    if (!bootstrapRes.ok) {
      const data = await bootstrapRes.json().catch(() => ({}));
      setError(
        data.message ?? data.error ?? "Could not set up your organization.",
      );
      return;
    }

    setStep("plan");
  }

  async function choosePlan(slug: string) {
    if (slug === "enterprise") {
      window.location.href =
        "mailto:sales@builtcrm.dev?subject=Enterprise%20plan%20inquiry";
      return;
    }
    setError(null);
    setPendingSlug(slug);
    const res = await fetch("/api/org/subscription/change-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSlug: slug, billingCycle }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      mode?: "checkout" | "updated";
      url?: string;
      error?: string;
      message?: string;
    };
    if (!res.ok || !data.ok) {
      setPendingSlug(null);
      setError(data.message ?? data.error ?? "Could not start trial.");
      return;
    }
    if (data.mode === "checkout" && data.url) {
      window.location.href = data.url;
      return;
    }
    // Fresh signup should always take the Checkout path; a direct update
    // response means the org somehow already has a subscription. Bail out
    // to the portal home.
    window.location.href = "/contractor";
  }

  if (step === "plan") {
    return (
      <PlanStep
        billingCycle={billingCycle}
        setBillingCycle={setBillingCycle}
        pendingSlug={pendingSlug}
        onChoose={choosePlan}
        error={error}
      />
    );
  }

  return (
    <form onSubmit={onAccountSubmit}>
      {error ? <div className="error-msg">{error}</div> : null}
      <div className="field-row">
        <div className="field">
          <label htmlFor="firstName">First name</label>
          <input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoComplete="given-name"
          />
        </div>
        <div className="field">
          <label htmlFor="lastName">Last name</label>
          <input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            autoComplete="family-name"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@company.com"
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </div>
      <div className="field">
        <label htmlFor="companyName">Company name</label>
        <input
          id="companyName"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          autoComplete="organization"
        />
      </div>
      <button type="submit" className="btn-auth" disabled={submitting}>
        {submitting ? "Creating account…" : "Continue"}
      </button>
    </form>
  );
}

function PlanStep({
  billingCycle,
  setBillingCycle,
  pendingSlug,
  onChoose,
  error,
}: {
  billingCycle: Cycle;
  setBillingCycle: (c: Cycle) => void;
  pendingSlug: string | null;
  onChoose: (slug: string) => void;
  error: string | null;
}) {
  return (
    <div>
      {error ? <div className="error-msg">{error}</div> : null}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            gap: 2,
            background: "var(--s2, #f3f4f6)",
            borderRadius: 10,
            padding: 3,
          }}
        >
          {(["monthly", "annual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setBillingCycle(c)}
              style={{
                height: 34,
                padding: "0 18px",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 650,
                color: billingCycle === c ? "#111827" : "#6b7280",
                background: billingCycle === c ? "#fff" : "transparent",
                boxShadow:
                  billingCycle === c ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
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
        className="signup-tier-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 12,
        }}
      >
        <style>{`@media (max-width: 860px) { .signup-tier-grid { grid-template-columns: 1fr !important; } }`}</style>
        {TIERS.map((t) => {
          const cents =
            billingCycle === "monthly" ? t.monthly : t.annual;
          const isPending = pendingSlug === t.slug;
          const isDisabled = pendingSlug !== null && !isPending;
          const isEnterprise = t.slug === "enterprise";
          return (
            <div
              key={t.slug}
              style={{
                border: t.featured
                  ? "2px solid #5b4fc7"
                  : "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: t.featured ? "#f5f3ff" : "#fff",
              }}
            >
              <div
                style={{
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  fontSize: 16,
                  fontWeight: 740,
                }}
              >
                {t.name}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#6b7280",
                  fontWeight: 520,
                  minHeight: 38,
                }}
              >
                {t.blurb}
              </div>
              <div style={{ fontSize: 13, color: "#374151", fontWeight: 520 }}>
                {cents != null ? (
                  <>
                    <strong style={{ color: "#111827", fontSize: 22 }}>
                      ${cents}
                    </strong>
                    /mo
                    {billingCycle === "annual" && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          marginTop: 2,
                        }}
                      >
                        Billed ${(cents * 12).toLocaleString()}/yr
                      </div>
                    )}
                  </>
                ) : (
                  <strong style={{ color: "#111827", fontSize: 18 }}>
                    Custom
                  </strong>
                )}
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 16,
                  fontSize: 12,
                  color: "#374151",
                  lineHeight: 1.7,
                  fontWeight: 520,
                }}
              >
                {t.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onChoose(t.slug)}
                disabled={isDisabled}
                style={{
                  marginTop: "auto",
                  height: 40,
                  borderRadius: 8,
                  border: "none",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  background: isEnterprise ? "#111827" : "#5b4fc7",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 650,
                  fontFamily: "'Instrument Sans',system-ui,sans-serif",
                  opacity: isDisabled ? 0.5 : 1,
                }}
              >
                {isPending
                  ? "Redirecting…"
                  : isEnterprise
                    ? "Contact sales"
                    : `Start ${t.name} trial`}
              </button>
            </div>
          );
        })}
      </div>
      <p
        style={{
          textAlign: "center",
          marginTop: 16,
          fontSize: 12,
          color: "#6b7280",
          fontWeight: 520,
        }}
      >
        14-day free trial, card required. We&apos;ll charge your card at the
        end of day 14 unless you cancel.
      </p>
    </div>
  );
}
