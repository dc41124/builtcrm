import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { getWorkerWeekView } from "@/domain/loaders/time-entries";
import { AuthorizationError } from "@/domain/permissions";

import { MobileTimesheet } from "./mobile-timesheet";
import "../m-time.css";

export default async function MobileTimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  const weekOffset = sp.week
    ? Math.max(-12, Math.min(0, parseInt(sp.week, 10) || 0))
    : 0;
  const { session } = await requireServerSession();
  let view;
  try {
    view = await getWorkerWeekView({ session, weekOffset });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login?next=/m/time/timesheet");
      return (
        <div style={{ padding: 24, fontSize: 13, color: "#c93b3b" }}>
          Forbidden: {err.message}
        </div>
      );
    }
    throw err;
  }
  return <MobileTimesheet view={view} />;
}
