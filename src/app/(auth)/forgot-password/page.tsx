"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/auth/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setSubmitting(false);
    if (res.error) {
      setError(res.error.message ?? "Could not send reset link");
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="success-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M22 6L9 19l-5-5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2>Check your email</h2>
        <p className="auth-sub">
          We&apos;ve sent a password reset link to{" "}
          <strong style={{ color: "var(--text-primary)" }}>{sentTo}</strong>. It
          will expire in 60 minutes.
        </p>
        <Link href="/login" className="btn-auth secondary">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <Link href="/login" className="back-link">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M19 12H5m0 0l7 7m-7-7l7-7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back to sign in
      </Link>

      <h2>Reset your password</h2>
      <p className="auth-sub">
        Enter the email address associated with your account and we&apos;ll
        send you a link to reset your password.
      </p>

      <form onSubmit={onSubmit}>
        {error ? <div className="error-msg">{error}</div> : null}
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoComplete="email"
          />
        </div>
        <button type="submit" className="btn-auth" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </div>
  );
}
