"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/auth/client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}

function ResetPasswordPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (!token) {
      setError("Reset token is missing or invalid");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await authClient.resetPassword({ newPassword: password, token });
    setSubmitting(false);
    if (res.error) {
      setError(res.error.message ?? "Could not reset password");
      return;
    }
    router.push("/login");
  }

  return (
    <div className="auth-card">
      <h2>Set a new password</h2>
      <p className="auth-sub">
        Choose a new password for your account. Make it at least 8 characters.
      </p>

      <form onSubmit={onSubmit}>
        {error ? <div className="error-msg">{error}</div> : null}
        <div className="field">
          <label htmlFor="password">New password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Enter it again"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
        <button type="submit" className="btn-auth" disabled={submitting}>
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>

      <div style={{ marginTop: 16, textAlign: "center" }}>
        <Link href="/login" className="field-link">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
