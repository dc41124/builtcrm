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
  );
}
