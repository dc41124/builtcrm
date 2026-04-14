import type { ReactNode } from "react";
import "./auth.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-root">
      <div className="auth-page">
        <div className="auth-brand">
          <div className="auth-brand-mark">BC</div>
          <div className="auth-brand-name">BuiltCRM</div>
        </div>
        {children}
      </div>
    </div>
  );
}
