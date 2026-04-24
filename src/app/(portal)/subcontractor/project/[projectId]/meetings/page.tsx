import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getMeetings,
  getMyMeetingActionItems,
  getRecentPublishedMinutes,
  type MeetingListRow,
  type MyActionItemRow,
  type RecentPublishedMinutesRow,
} from "@/domain/loaders/meetings";
import { AuthorizationError } from "@/domain/permissions";

import { SubMeetingsList } from "./list-ui";
import "../../../../meetings.css";

export default async function SubMeetingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let rows: MeetingListRow[] = [];
  let myActions: MyActionItemRow[] = [];
  let recentMinutes: RecentPublishedMinutesRow[] = [];
  try {
    const [view, actions, minutes] = await Promise.all([
      getMeetings({
        session: session.session as unknown as { appUserId?: string | null },
        projectId,
      }),
      getMyMeetingActionItems({
        session: session.session as unknown as { appUserId?: string | null },
        projectId,
      }),
      getRecentPublishedMinutes({
        session: session.session as unknown as { appUserId?: string | null },
        projectId,
        limit: 3,
      }),
    ]);
    rows = view.rows;
    myActions = actions;
    recentMinutes = minutes;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="mt-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return (
    <div className="mt-content">
      <SubMeetingsList
        projectId={projectId}
        rows={rows}
        myActions={myActions}
        recentMinutes={recentMinutes}
      />
    </div>
  );
}
