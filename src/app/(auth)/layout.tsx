import type { ReactNode } from "react";
import "./auth.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-root">
      <div className="auth-page">
        <div className="auth-brand">
          <div className="auth-brand-mark" aria-hidden>
            <svg viewBox="0 0 80 80" width="28" height="28">
              <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5" />
              <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75" />
              <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95" />
            </svg>
          </div>
          <div className="auth-brand-name">BuiltCRM</div>
        </div>
        {children}
      </div>
    </div>
  );
}
