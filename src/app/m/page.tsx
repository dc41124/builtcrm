import { redirect } from "next/navigation";
import Link from "next/link";

import { requireServerSession } from "@/auth/session";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// /m landing — gateway. Subs land on /m/time (the most-used module).
// Contractors are not the primary target of the PWA but we still let
// them in: route them to /m/safety/forms because contractors can
// review submissions but the time module is sub-internal.
export default async function MobileLandingPage() {
  const { session } = await requireServerSession();
  try {
    const ctx = await getOrgContext(session);
    if (ctx.role === "subcontractor_user") {
      redirect("/m/time");
    }
    if (ctx.role === "contractor_admin" || ctx.role === "contractor_pm") {
      redirect("/m/safety/forms");
    }
  } catch (err) {
    if (err instanceof AuthorizationError && err.code === "unauthenticated") {
      redirect("/login?next=/m");
    }
    throw err;
  }
  // Clients / unknown roles get a tiny landing rather than a redirect loop.
  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <h1
        style={{
          fontFamily: "DM Sans, system-ui",
          fontWeight: 780,
          fontSize: 22,
          margin: "0 0 8px",
          letterSpacing: "-0.02em",
        }}
      >
        BuiltCRM Mobile
      </h1>
      <p style={{ fontSize: 14, color: "#5a5852", lineHeight: 1.5 }}>
        Mobile is currently optimized for subcontractor field workflows.
        Open the desktop site for the full experience.
      </p>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}
      >
        <Link
          href="/m/safety/forms"
          style={{
            display: "block",
            padding: "12px 16px",
            borderRadius: 10,
            background: "#5b4fc7",
            color: "#fff",
            textDecoration: "none",
            fontFamily: "DM Sans, system-ui",
            fontWeight: 660,
          }}
        >
          Safety forms
        </Link>
        <Link
          href="/m/time"
          style={{
            display: "block",
            padding: "12px 16px",
            borderRadius: 10,
            background: "#3d6b8e",
            color: "#fff",
            textDecoration: "none",
            fontFamily: "DM Sans, system-ui",
            fontWeight: 660,
          }}
        >
          Time tracking
        </Link>
      </div>
    </div>
  );
}
