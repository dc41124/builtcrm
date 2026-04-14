"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/auth/client";

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
      body: JSON.stringify({ token }),
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
