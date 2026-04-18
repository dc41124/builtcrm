"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/auth/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await signIn.email({
      email,
      password,
      rememberMe: remember,
      callbackURL: next,
    });
    setSubmitting(false);
    if (res.error) {
      setError(res.error.message ?? "Sign-in failed");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <>
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p className="auth-sub">
          Sign in to your account to access your projects.
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

          <div className="field">
            <div className="field-header">
              <label htmlFor="password">Password</label>
              <Link href="/forgot-password" className="field-link">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="checkbox-row">
            <input
              id="remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <label htmlFor="remember">Keep me signed in</label>
          </div>

          <button type="submit" className="btn-auth" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <div className="auth-footer">
        New to BuiltCRM?{" "}
        <Link href="/signup/contractor">Create a contractor account</Link>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
          Have an invitation? <Link href="/signup">Accept invite instead</Link>
        </div>
      </div>
    </>
  );
}
