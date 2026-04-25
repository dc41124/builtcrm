import { redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { getSubPrequalListView } from "@/domain/loaders/prequal";
import { AuthorizationError } from "@/domain/permissions";

import "../../../prequalification.css";
import { SubListWorkspace } from "./workspace";

export default async function SubPrequalListPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");
  const sessionLike = sessionData.session;

  try {
    const view = await getSubPrequalListView({ session: sessionLike });
    return (
      <div className="pq-content">
        <SubListWorkspace rows={view.rows} tab={sp.tab ?? "open"} />
      </div>
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return (
        <div className="pq-content">
          <pre>Forbidden: {err.message}</pre>
        </div>
      );
    }
    throw err;
  }
}
