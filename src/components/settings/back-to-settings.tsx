import Link from "next/link";

// Renders a small "Back to settings" link at the top of a navigate-out
// page (webhooks catalog, api keys, custom fields). Used so users have a
// way home after landing on a standalone admin surface that no longer
// shares the SettingsShell tab navigation.

export function BackToSettingsLink({
  href = "/contractor/settings",
  label = "Back to settings",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "'Instrument Sans',system-ui,sans-serif",
        fontSize: 12.5,
        fontWeight: 580,
        color: "var(--t2)",
        textDecoration: "none",
        marginBottom: 14,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
      {label}
    </Link>
  );
}
