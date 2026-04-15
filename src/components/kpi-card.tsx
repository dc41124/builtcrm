import type { ReactNode } from "react";

export type KpiTrendType = "up" | "down" | "warn";
export type KpiAccent = "blue" | "purple" | "green" | "amber" | "red";

export type KpiCardProps = {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  trend?: string;
  trendType?: KpiTrendType;
  icon?: ReactNode;
  iconColor?: KpiAccent;
  alert?: boolean;
};

export function KpiCard({
  label,
  value,
  meta,
  trend,
  trendType = "up",
  icon,
  iconColor = "purple",
  alert = false,
}: KpiCardProps) {
  return (
    <>
      <div className={`bc-kpi ${alert ? "bc-kpi-alert" : ""}`}>
        <div className="bc-kpi-top">
          <div className="bc-kpi-label">{label}</div>
          {icon && <div className={`bc-kpi-ico bc-kpi-ico-${iconColor}`}>{icon}</div>}
        </div>
        <div className="bc-kpi-value">{value}</div>
        {(meta || trend) && (
          <div className="bc-kpi-meta">
            {meta}
            {trend && (
              <>
                {meta ? " · " : ""}
                <span className={`bc-kpi-trend bc-kpi-trend-${trendType}`}>{trend}</span>
              </>
            )}
          </div>
        )}
      </div>
      <style>{`
        .bc-kpi{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:16px;transition:all var(--dn) var(--e)}
        .bc-kpi:hover{box-shadow:var(--shmd);border-color:var(--s4)}
        .bc-kpi-alert{border-color:var(--wr);border-width:1.5px}
        .bc-kpi-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
        .bc-kpi-label{font-family:var(--fb);font-size:12px;font-weight:560;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .bc-kpi-ico{width:28px;height:28px;border-radius:var(--r-s);display:grid;place-items:center}
        .bc-kpi-ico-blue{background:var(--in-s);color:var(--in-t)}
        .bc-kpi-ico-purple{background:var(--ac-s);color:var(--ac-t)}
        .bc-kpi-ico-green{background:var(--ok-s);color:var(--ok-t)}
        .bc-kpi-ico-amber{background:var(--wr-s);color:var(--wr-t)}
        .bc-kpi-ico-red{background:var(--dg-s);color:var(--dg-t)}
        .bc-kpi-value{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.1}
        .bc-kpi-meta{font-family:var(--fb);font-size:12px;font-weight:580;color:var(--t2);margin-top:4px}
        .bc-kpi-trend{font-weight:720}
        .bc-kpi-trend-up{color:var(--ok-t)}
        .bc-kpi-trend-down{color:var(--dg-t)}
        .bc-kpi-trend-warn{color:var(--wr-t)}
      `}</style>
    </>
  );
}
