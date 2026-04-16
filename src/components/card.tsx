"use client";

import { useState, type ReactNode } from "react";

export type CardTab = { id: string; label: string };

export type CardProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  headerRight?: ReactNode;
  tabs?: CardTab[];
  activeTabId?: string;
  onTabChange?: (id: string) => void;
  alert?: boolean;
  padded?: boolean;
  className?: string;
  children: ReactNode;
};

export function Card({
  title,
  subtitle,
  headerRight,
  tabs,
  activeTabId,
  onTabChange,
  alert = false,
  padded = true,
  className = "",
  children,
}: CardProps) {
  const [internalActive, setInternalActive] = useState(tabs?.[0]?.id);
  const active = activeTabId ?? internalActive;
  const handleTab = (id: string) => {
    if (onTabChange) onTabChange(id);
    else setInternalActive(id);
  };
  const hasHeader = title || subtitle || headerRight;
  return (
    <div className={`bc-card ${alert ? "bc-card-alert" : ""} ${className}`}>
      {hasHeader && (
        <div className="bc-card-head">
          <div className="bc-card-head-left">
            {title && <div className="bc-card-title">{title}</div>}
            {subtitle && <div className="bc-card-sub">{subtitle}</div>}
          </div>
          {headerRight && <div className="bc-card-head-right">{headerRight}</div>}
        </div>
      )}
      {tabs && (
        <div className="bc-card-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`bc-card-tab ${active === t.id ? "bc-card-tab-active" : ""}`}
              onClick={() => handleTab(t.id)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className={padded ? "bc-card-body" : ""}>{children}</div>
    </div>
  );
}
