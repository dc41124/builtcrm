import type { ReactNode } from "react";

export type PillColor = "green" | "red" | "amber" | "blue" | "gray" | "purple";

export type PillProps = {
  color?: PillColor;
  children: ReactNode;
  className?: string;
};

export function Pill({ color = "gray", children, className = "" }: PillProps) {
  return (
    <>
      <span className={`bc-pill bc-pill-${color} ${className}`}>{children}</span>
      <style dangerouslySetInnerHTML={{ __html: `
        .bc-pill{height:22px;padding:0 8px;border-radius:999px;font-family:var(--fd);font-size:11px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap;line-height:1}
        .bc-pill-red{background:var(--dg-s);color:var(--dg-t)}
        .bc-pill-amber{background:var(--wr-s);color:var(--wr-t)}
        .bc-pill-green{background:var(--ok-s);color:var(--ok-t)}
        .bc-pill-blue{background:var(--in-s);color:var(--in-t)}
        .bc-pill-purple{background:var(--ac-s);color:var(--ac-t)}
        .bc-pill-gray{background:var(--s2);color:var(--t2)}
      ` }} />
    </>
  );
}
