"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/auth/client";

import { CONSENT_CATALOG, type ConsentTypeKey } from "@/lib/privacy/consent-catalog";

export function SignupForm({
  token,
  email,
  isResidential,
  showCompanyField,
}: {
  token: string;
  email: string;
  isResidential: boolean;
  showCompanyField: boolean;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 65 Session C — consent checklist. Initial state from catalog
  // defaults; required consents stay locked at true. The map only
  // captures user-modifiable values; the API helper applies defaults
  // for anything unset.
  const [optionalConsents, setOptionalConsents] = useState<
    Partial<Record<ConsentTypeKey, boolean>>
  >(() => {
    const init: Partial<Record<ConsentTypeKey, boolean>> = {};
    for (const meta of CONSENT_CATALOG) {
      if (!meta.required) init[meta.id] = meta.defaultGranted;
    }
    return init;
  });

  async function onSubmit(e: React.FormEvent) {
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
      // Already-registered users hit this path; nudge them to sign in to
      // accept the invite from their existing account.
      setError(
        signupRes.error.message ??
          "Could not create account. Try signing in instead.",
      );
      return;
    }

    const acceptRes = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, optionalConsents }),
    });
    setSubmitting(false);
    if (!acceptRes.ok) {
      const data = await acceptRes.json().catch(() => ({}));
      setError(data.message ?? data.error ?? "Could not accept invitation");
      return;
    }

    router.push(`/welcome?token=${encodeURIComponent(token)}`);
    router.refresh();
  }

  const accent = isResidential ? "residential" : "";

  return (
    <form onSubmit={onSubmit}>
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
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} readOnly />
        <div className="field-hint">
          This is the email your invitation was sent to
        </div>
      </div>
      <div className="field">
        <label htmlFor="password">
          {isResidential ? "Create a password" : "Password"}
        </label>
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
      {showCompanyField ? (
        <div className="field">
          <label htmlFor="companyName">Company name (optional)</label>
          <input
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            autoComplete="organization"
          />
        </div>
      ) : null}

      {/* Step 65 Session C — consent checklist. Required consents are
          shown locked-on; optional consents start at the catalog default.
          Subjects can revisit and toggle these later under Settings →
          Privacy & consents. */}
      <div className="signup-consents">
        <div className="signup-consents-title">Privacy preferences</div>
        <div className="signup-consents-sub">
          You can change any of these later under Settings → Privacy &amp; consents.
          See our <Link href="/privacy" className="signup-consents-link">Privacy Policy</Link>{" "}
          for details, or <Link href="/privacy/dsar" className="signup-consents-link">submit a privacy request</Link> at any time.
        </div>
        <ul className="signup-consents-list">
          {CONSENT_CATALOG.map((meta) => {
            const checked = meta.required ? true : !!optionalConsents[meta.id];
            return (
              <li key={meta.id} className="signup-consents-item">
                <label className="signup-consents-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={meta.required}
                    onChange={(e) =>
                      setOptionalConsents((prev) => ({
                        ...prev,
                        [meta.id]: e.target.checked,
                      }))
                    }
                  />
                  <span className="signup-consents-body">
                    <span className="signup-consents-label">
                      {meta.label}
                      {meta.required ? <span className="signup-consents-required">Required</span> : null}
                    </span>
                    <span className="signup-consents-desc">{meta.description}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <button type="submit" className={`btn-auth ${accent}`} disabled={submitting}>
        {submitting
          ? "Creating account…"
          : isResidential
            ? "Create my account"
            : "Create account"}
      </button>
    </form>
  );
}
