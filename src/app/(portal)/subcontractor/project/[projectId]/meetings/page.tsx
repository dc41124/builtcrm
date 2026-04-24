import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getMeetings,
  getMyMeetingActionItems,
  type MeetingListRow,
  type MyActionItemRow,
} from "@/domain/loaders/meetings";
import { AuthorizationError } from "@/domain/permissions";

import {
  Icon,
  MeetingTypePill,
  StatusPill,
  formatScheduledAt,
} from "../../../../meetings-shared";
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
  try {
    const [view, actions] = await Promise.all([
      getMeetings({
        session: session.session as unknown as { appUserId?: string | null },
        projectId,
      }),
      getMyMeetingActionItems({
        session: session.session as unknown as { appUserId?: string | null },
        projectId,
      }),
    ]);
    rows = view.rows;
    myActions = actions;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="mt-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  const portalBase = `/subcontractor/project/${projectId}`;
  const upcoming = rows.filter(
    (r) => r.status === "scheduled" || r.status === "in_progress",
  );
  const past = rows.filter(
    (r) => r.status === "completed" || r.status === "cancelled",
  );

  const openActions = myActions.filter((a) => a.status !== "done");
  const overdueCount = openActions.filter(
    (a) => a.dueStatus === "overdue",
  ).length;

  return (
    <div className="mt-content">
      <div className="mt-page-hdr">
        <div>
          <h1 className="mt-page-title">Meetings</h1>
          <div className="mt-page-sub">
            Every meeting you&apos;re invited to on this project — plus your
            open action items across all of them.
          </div>
        </div>
      </div>

      <div className="mt-kpi-strip four">
        <div className="mt-kpi">
          <div className="mt-kpi-label">Upcoming</div>
          <div className="mt-kpi-val">{upcoming.length}</div>
          <div className="mt-kpi-sub">Scheduled + in progress</div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">My open actions</div>
          <div className="mt-kpi-val">{openActions.length}</div>
          <div className="mt-kpi-sub">
            {overdueCount > 0
              ? `${overdueCount} overdue`
              : "All on schedule"}
          </div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">Completed</div>
          <div className="mt-kpi-val">
            {past.filter((r) => r.status === "completed").length}
          </div>
          <div className="mt-kpi-sub">This project</div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">Cancelled</div>
          <div className="mt-kpi-val">
            {past.filter((r) => r.status === "cancelled").length}
          </div>
          <div className="mt-kpi-sub">Won&apos;t count toward attendance</div>
        </div>
      </div>

      <div className="mt-workspace">
        <div>
          {rows.length === 0 ? (
            <div className="mt-empty">
              <h3>No meetings invited to your team yet</h3>
              <p>
                When the GC schedules a coordination or OAC meeting and
                adds your org, it will show up here.
              </p>
            </div>
          ) : (
            <>
              {upcoming.length > 0 ? (
                <>
                  <h4
                    style={{
                      margin: "0 0 10px",
                      fontFamily: '"DM Sans", sans-serif',
                      fontWeight: 720,
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Upcoming · {upcoming.length}
                  </h4>
                  <div className="mt-list" style={{ marginBottom: 18 }}>
                    <div className="mt-list-hdr">
                      <div>Number</div>
                      <div>Title</div>
                      <div>Type</div>
                      <div>When</div>
                      <div>Chair</div>
                      <div>Status</div>
                      <div>Open</div>
                    </div>
                    {upcoming.map((r) => (
                      <MeetingRow
                        key={r.id}
                        r={r}
                        href={`${portalBase}/meetings/${r.id}`}
                      />
                    ))}
                  </div>
                </>
              ) : null}

              {past.length > 0 ? (
                <>
                  <h4
                    style={{
                      margin: "0 0 10px",
                      fontFamily: '"DM Sans", sans-serif',
                      fontWeight: 720,
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Completed · {past.length}
                  </h4>
                  <div className="mt-list">
                    <div className="mt-list-hdr">
                      <div>Number</div>
                      <div>Title</div>
                      <div>Type</div>
                      <div>When</div>
                      <div>Chair</div>
                      <div>Status</div>
                      <div>Open</div>
                    </div>
                    {past.map((r) => (
                      <MeetingRow
                        key={r.id}
                        r={r}
                        href={`${portalBase}/meetings/${r.id}`}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>

        <aside className="mt-rail">
          <div className="mt-rail-card">
            <div className="mt-rail-hdr">
              <h4>
                {Icon.clipboard} My actions ({openActions.length})
              </h4>
            </div>
            {openActions.length === 0 ? (
              <div
                style={{
                  padding: "20px 18px",
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: 12.5,
                }}
              >
                Nothing on your plate from meetings. Nice.
              </div>
            ) : (
              openActions.map((a) => (
                <Link
                  key={a.id}
                  href={`${portalBase}/meetings/${a.meetingId}`}
                  className="mt-sub-action"
                >
                  <div className="mt-sub-action-top">
                    <span className="mt-sub-action-desc">{a.description}</span>
                    <span className="mt-sub-action-ref">
                      {a.meetingNumberLabel}
                    </span>
                  </div>
                  <div className="mt-sub-action-meta">
                    <span
                      className={`mt-sub-action-due${
                        a.dueStatus === "overdue"
                          ? " overdue"
                          : a.dueStatus === "soon"
                            ? " soon"
                            : ""
                      }`}
                    >
                      {a.dueDate ? `Due ${a.dueDate}` : "No due date"}
                    </span>
                    <span>·</span>
                    <span>
                      {a.status === "in_progress"
                        ? "In progress"
                        : a.status === "done"
                          ? "Done"
                          : "Open"}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function MeetingRow({ r, href }: { r: MeetingListRow; href: string }) {
  const s = formatScheduledAt(r.scheduledAt);
  return (
    <Link className="mt-row" href={href}>
      <div className="mt-row-num">{r.numberLabel}</div>
      <div>
        <div className="mt-row-title">{r.title}</div>
        <div className="mt-row-sub">
          {Icon.users} {r.attendeeCount} attendees
        </div>
      </div>
      <div>
        <MeetingTypePill type={r.type} />
      </div>
      <div>
        <div className="mt-row-when">
          {s.dayLabel} {s.dayNumber}
        </div>
        <div className="mt-row-when-sub">{s.timeLabel}</div>
      </div>
      <div>
        <div className="mt-row-chair">{r.chairName ?? "—"}</div>
        {r.chairOrgName ? (
          <div className="mt-row-chair-sub">{r.chairOrgName}</div>
        ) : null}
      </div>
      <div>
        <StatusPill status={r.status} />
      </div>
      <div>
        <span
          className={`mt-row-count${r.actionOpenCount === 0 ? " zero" : ""}`}
        >
          {r.actionOpenCount > 0 ? r.actionOpenCount : "—"}
        </span>
      </div>
    </Link>
  );
}
