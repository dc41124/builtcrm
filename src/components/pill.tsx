import type { ReactNode } from "react";

export type PillColor = "green" | "red" | "amber" | "blue" | "gray" | "purple";

export type PillProps = {
  color?: PillColor;
  children: ReactNode;
  className?: string;
};

export function Pill({ color = "gray", children, className = "" }: PillProps) {
  return (
    <span className={`bc-pill bc-pill-${color} ${className}`}>{children}</span>
  );
}
