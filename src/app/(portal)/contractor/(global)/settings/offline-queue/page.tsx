import Link from "next/link";
import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

import { OfflineQueueClient } from "./offline-queue-client";

// Step 51 — pending offline writes that haven't synced yet. Contractor-only
// since daily logs (the only producer in v1) are contractor-authored. The
// page itself is a server component for the auth check; the queue list is
// read from IndexedDB so everything below the header is client-side.
export default async function OfflineQueuePage() {
  const { session } = await requireServerSession();
  try {
    const ctx = await getOrgContext(session);
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      redirect("/");
    }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      redirect("/");
    }
    throw err;
  }

  return (
    <div style={{ padding: "24px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Link
          href="/contractor/settings"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 6,
            color: "var(--t2)",
            fontSize: 12.5,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 620,
            textDecoration: "none",
          }}
        >
          ← Settings
        </Link>
        <div>
          <h1
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 26,
              fontWeight: 770,
              letterSpacing: "-0.025em",
              margin: 0,
            }}
          >
            Offline queue
          </h1>
          <div
            style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: 13,
              color: "var(--t2)",
              fontWeight: 540,
              marginTop: 3,
            }}
          >
            Daily logs you saved while offline. They sync automatically when
            you&apos;re back online.
          </div>
        </div>
      </div>

      <OfflineQueueClient />
    </div>
  );
}
