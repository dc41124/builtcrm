import type { ReactNode } from "react";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  cta?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, cta, className = "" }: EmptyStateProps) {
  return (
    <>
      <div className={`bc-empty ${className}`}>
        {icon && <div className="bc-empty-ico">{icon}</div>}
        <div className="bc-empty-title">{title}</div>
        {description && <div className="bc-empty-desc">{description}</div>}
        {cta && <div className="bc-empty-cta">{cta}</div>}
      </div>
      <style>{`
        .bc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px 24px;gap:8px}
        .bc-empty-ico{width:48px;height:48px;border-radius:var(--r-m);background:var(--s2);color:var(--t3);display:grid;place-items:center;margin-bottom:8px}
        .bc-empty-title{font-family:var(--fd);font-size:15px;font-weight:720;color:var(--t1);letter-spacing:-.01em}
        .bc-empty-desc{font-family:var(--fb);font-size:13px;font-weight:520;color:var(--t2);max-width:360px}
        .bc-empty-cta{margin-top:12px}
      `}</style>
    </>
  );
}
