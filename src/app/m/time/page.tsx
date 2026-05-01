import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { getWorkerWeekView } from "@/domain/loaders/time-entries";
import { AuthorizationError } from "@/domain/permissions";

import { MobileTimeToday } from "./mobile-today";
import "./m-time.css";

export default async function MobileTimePage() {
  const { session } = await requireServerSession();
  let view;
  try {
    view = await getWorkerWeekView({ session, weekOffset: 0 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login?next=/m/time");
      return (
        <div style={{ padding: 24, fontSize: 13, color: "#c93b3b" }}>
          Forbidden: {err.message}
        </div>
      );
    }
    throw err;
  }
  return <MobileTimeToday view={view} />;
}
