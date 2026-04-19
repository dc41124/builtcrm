"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Grouped bar chart — two series (RFIs, Change Orders) across four
// age buckets. The 30+ bar's fill escalates to a warning red so a
// scanning eye lands on it first when it's non-zero (advisor
// refinement: a month-old open item is an operational risk signal,
// not just a data point).
//
// Typography + colors are pulled from CSS variables so portal
// accents stay consistent. The chart sits inside a ResponsiveContainer
// so recharts handles the mobile-stack resize natively.

export type AgingDatum = {
  bucket: "0_7" | "8_14" | "15_30" | "30_plus";
  label: string;
  rfis: number;
  changeOrders: number;
};

const BAR_COLORS = {
  rfis: "#5b4fc7",
  changeOrders: "#3d6b8e",
  risk: "#c14c4c",
} as const;

// Standard tick/label styling — DM Sans via CSS var `--fd`. We read
// the actual font family from the document's computed style so the
// SVG labels inherit the same font stack as the rest of the UI.
const axisTickStyle = {
  fontFamily: "var(--fd, 'DM Sans', system-ui, sans-serif)",
  fontSize: 11,
  fontWeight: 600,
  fill: "var(--t3, #64687a)",
} as const;

export function AgingBarChart({
  data,
  height = 260,
  ariaLabel = "RFI and change-order aging",
}: {
  data: AgingDatum[];
  height?: number;
  ariaLabel?: string;
}) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 12, bottom: 0, left: -10 }}
          barGap={4}
          barCategoryGap="22%"
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--s3, #e6e9ef)"
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey="label"
            tick={axisTickStyle}
            tickLine={false}
            axisLine={{ stroke: "var(--s3, #e6e9ef)" }}
          />
          <YAxis
            allowDecimals={false}
            tick={axisTickStyle}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ fill: "var(--s2, #f4f6fa)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--s3, #e6e9ef)",
              fontFamily: "var(--fb, 'Instrument Sans', system-ui, sans-serif)",
              fontSize: 12,
              padding: "8px 10px",
              boxShadow: "0 4px 12px rgba(20,22,30,0.08)",
            }}
            labelStyle={{
              color: "var(--t1, #12141b)",
              fontWeight: 700,
              fontFamily: "var(--fd, 'DM Sans', system-ui, sans-serif)",
              marginBottom: 4,
            }}
          />
          <Legend
            wrapperStyle={{
              fontFamily: "var(--fd, 'DM Sans', system-ui, sans-serif)",
              fontSize: 11,
              fontWeight: 620,
              paddingTop: 8,
            }}
            iconType="circle"
            iconSize={8}
          />
          <Bar
            dataKey="rfis"
            name="RFIs"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell
                key={`rfi-${d.bucket}`}
                fill={d.bucket === "30_plus" && d.rfis > 0 ? BAR_COLORS.risk : BAR_COLORS.rfis}
              />
            ))}
          </Bar>
          <Bar
            dataKey="changeOrders"
            name="Change orders"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell
                key={`co-${d.bucket}`}
                fill={
                  d.bucket === "30_plus" && d.changeOrders > 0
                    ? BAR_COLORS.risk
                    : BAR_COLORS.changeOrders
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
