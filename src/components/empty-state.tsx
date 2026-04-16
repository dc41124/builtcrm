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
    <div className={`bc-empty ${className}`}>
      {icon && <div className="bc-empty-ico">{icon}</div>}
      <div className="bc-empty-title">{title}</div>
      {description && <div className="bc-empty-desc">{description}</div>}
      {cta && <div className="bc-empty-cta">{cta}</div>}
    </div>
  );
}
