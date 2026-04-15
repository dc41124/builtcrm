import type { ReactNode } from "react";

export type ComingSoonProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
};

export function ComingSoon({ title, description, icon }: ComingSoonProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "3rem 2rem",
        textAlign: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: "var(--surface-2, #f4f4f6)",
          color: "var(--text-3, #6b6674)",
          display: "grid",
          placeItems: "center",
          marginBottom: 20,
        }}
      >
        {icon ?? (
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        )}
      </div>
      <h1
        style={{
          fontFamily: "'DM Sans',system-ui,sans-serif",
          fontSize: 22,
          fontWeight: 720,
          letterSpacing: "-0.01em",
          color: "var(--text-1, #1a1714)",
          margin: 0,
          marginBottom: 8,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontFamily: "'Instrument Sans',system-ui,sans-serif",
          fontSize: 14,
          fontWeight: 520,
          color: "var(--text-3, #6b6674)",
          maxWidth: 420,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {description ??
          "This page is part of the remaining build. It will be filled in as each prototype is matched to its implementation."}
      </p>
    </div>
  );
}
