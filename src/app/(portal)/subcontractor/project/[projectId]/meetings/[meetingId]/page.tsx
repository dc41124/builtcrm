import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getMeeting, type MeetingDetail } from "@/domain/loaders/meetings";
import { AuthorizationError } from "@/domain/permissions";

import { SubMeetingDetailUI } from "./detail";
import "../../../../../meetings.css";

export default async function SubMeetingDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; meetingId: string }>;
}) {
  const { projectId, meetingId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let detail: MeetingDetail | null = null;
  try {
    detail = await getMeeting({
      session: session.session as unknown as { appUserId?: string | null },
      meetingId,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="mt-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }
  if (!detail) notFound();

  return (
    <div className="mt-content">
      <SubMeetingDetailUI
        projectId={projectId}
        meetingId={meetingId}
        detail={detail}
      />
    </div>
  );
}
