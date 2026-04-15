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
  const hasHeader = title || subtitle || headerRight || tabs;
  return (
    <>
      <div className={`bc-card ${alert ? "bc-card-alert" : ""} ${className}`}>
        {hasHeader && (
          <div className="bc-card-head">
            <div className="bc-card-head-left">
              {title && <div className="bc-card-title">{title}</div>}
              {subtitle && <div className="bc-card-sub">{subtitle}</div>}
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
            </div>
            {headerRight && <div className="bc-card-head-right">{headerRight}</div>}
          </div>
        )}
        <div className={padded ? "bc-card-body" : ""}>{children}</div>
      </div>
      <style>{`
        .bc-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden;box-shadow:var(--shsm);transition:box-shadow var(--dn) var(--e)}
        .bc-card-alert{border-color:var(--wr);border-width:1.5px}
        .bc-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 20px;border-bottom:1px solid var(--s3)}
        .bc-card-head-left{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
        .bc-card-title{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);letter-spacing:-.01em}
        .bc-card-sub{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2)}
        .bc-card-head-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
        .bc-card-tabs{display:flex;gap:4px;margin-top:10px}
        .bc-card-tab{background:transparent;border:none;font-family:var(--fb);font-size:13px;font-weight:600;color:var(--t2);padding:6px 12px;border-radius:var(--r-s);cursor:pointer;transition:all var(--df) var(--e)}
        .bc-card-tab:hover{background:var(--sh);color:var(--t1)}
        .bc-card-tab-active{background:var(--s2);color:var(--t1);font-weight:720}
        .bc-card-body{padding:16px 20px}
      `}</style>
    </>
  );
}
