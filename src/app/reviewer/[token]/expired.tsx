import Link from "next/link";

// Expired / consumed / revoked / not-found token landing.
//
// Reviewers are external stakeholders who will blame the GC if the
// link "looks broken" — so every failure mode gets an explicit
// explanation + contact info, never a generic 404. The calling page
// resolves the GC user behind the invitation and passes name + email
// even when the token itself is invalid (as long as we can identify
// who sent it).

export type ReviewerExpiredReason =
  | "not_found"
  | "expired"
  | "consumed"
  | "revoked"
  | "invalid_scope";

const ACCENT = "#5b4fc7";

const COPY: Record<
  ReviewerExpiredReason,
  { title: string; body: string }
> = {
  not_found: {
    title: "This invitation link is no longer valid",
    body: "The link may have been mistyped or the invitation was cancelled.",
  },
  expired: {
    title: "This invitation has expired",
    body: "Invitations are time-limited for security. You'll need a fresh link to continue.",
  },
  consumed: {
    title: "This review has already been submitted",
    body: "Each invitation can only be used once. If you need to update your decision, the contractor can send you a new invitation.",
  },
  revoked: {
    title: "This invitation was cancelled",
    body: "The contractor revoked this link, likely because they sent you a newer one. Check your email for the most recent invitation.",
  },
  invalid_scope: {
    title: "This link is for a different kind of invitation",
    body: "Try signing in through the normal login flow if you have an account.",
  },
};

export function ReviewerExpired({
  reason,
  gcName,
  gcEmail,
}: {
  reason: ReviewerExpiredReason;
  gcName: string | null;
  gcEmail: string | null;
}) {
  const { title, body } = COPY[reason];
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#f4f6fa",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          background: "#fff",
          border: "1px solid #e6e9ef",
          borderRadius: 14,
          padding: "36px 32px",
          boxShadow: "0 8px 30px rgba(20,22,30,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 18,
            color: ACCENT,
          }}
        >
          <CascadingLogo />
          <span
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 740,
              fontSize: 14,
              color: "#2b2f3d",
              letterSpacing: "-0.01em",
            }}
          >
            BuiltCRM
          </span>
        </div>
        <h1
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 820,
            letterSpacing: "-0.01em",
            margin: "0 0 10px",
            color: "#12141b",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "#4a4f60",
            margin: "0 0 22px",
          }}
        >
          {body}
        </p>
        <div
          style={{
            padding: "14px 16px",
            background: "#f4f6fa",
            border: "1px solid #e6e9ef",
            borderRadius: 10,
          }}
        >
          <div
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "#64687a",
              marginBottom: 6,
            }}
          >
            Contact the contractor
          </div>
          <div
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 14,
              fontWeight: 620,
              color: "#12141b",
            }}
          >
            {gcName ?? "Your contractor"}
          </div>
          {gcEmail ? (
            <Link
              href={`mailto:${gcEmail}?subject=Submittal%20invitation%20link`}
              style={{
                display: "inline-block",
                marginTop: 4,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: ACCENT,
                textDecoration: "none",
                fontWeight: 620,
              }}
            >
              {gcEmail}
            </Link>
          ) : (
            <div style={{ marginTop: 4, fontSize: 12, color: "#64687a" }}>
              Reach out to the contractor directly for a new link.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CascadingLogo() {
  // The three-rectangle cascading logo per the CLAUDE.md design rules.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect
        x="2"
        y="4"
        width="14"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="5"
        y="10"
        width="14"
        height="4"
        rx="1"
        fill="currentColor"
      />
      <rect
        x="8"
        y="16"
        width="14"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}
