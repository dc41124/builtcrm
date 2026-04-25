import { type DB } from "@/db/client";
import { emitNotifications } from "@/lib/notifications/emit";

type DbOrTx = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

// Fire an in-app notification for a closeout-package state change. No
// email provider yet — the notification catalog marks these events as
// critical so email toggle is on by default; the real send is TODO.
// Structured console log in the meantime for parity with the transmittals
// email stub.
export async function notifyCloseoutDelivered(
  dbc: DbOrTx,
  input: {
    projectId: string;
    packageId: string;
    numberLabel: string;
    projectName: string;
    actorUserId: string;
    actorName: string | null;
  },
): Promise<void> {
  console.log(
    "[closeout.email_stub]",
    JSON.stringify({
      kind: "closeout_package_delivered",
      packageId: input.packageId,
      number: input.numberLabel,
      projectId: input.projectId,
      projectName: input.projectName,
    }),
  );
  await emitNotifications(
    {
      eventId: "closeout_package_delivered",
      actorUserId: input.actorUserId,
      projectId: input.projectId,
      relatedObjectType: "closeout_package",
      relatedObjectId: input.packageId,
      vars: {
        number: input.numberLabel,
        projectName: input.projectName,
        actorName: input.actorName ?? "Your contractor",
      },
    },
    dbc,
  );
}

export async function notifyCloseoutCommented(
  dbc: DbOrTx,
  input: {
    projectId: string;
    packageId: string;
    numberLabel: string;
    actorUserId: string;
    actorName: string | null;
    preview: string;
  },
): Promise<void> {
  await emitNotifications(
    {
      eventId: "closeout_package_commented",
      actorUserId: input.actorUserId,
      projectId: input.projectId,
      relatedObjectType: "closeout_package",
      relatedObjectId: input.packageId,
      vars: {
        number: input.numberLabel,
        actorName: input.actorName ?? "The owner",
        preview: input.preview,
      },
    },
    dbc,
  );
}

export async function notifyCloseoutAccepted(
  dbc: DbOrTx,
  input: {
    projectId: string;
    packageId: string;
    numberLabel: string;
    actorUserId: string;
    actorName: string | null;
  },
): Promise<void> {
  console.log(
    "[closeout.email_stub]",
    JSON.stringify({
      kind: "closeout_package_accepted",
      packageId: input.packageId,
      number: input.numberLabel,
      projectId: input.projectId,
    }),
  );
  await emitNotifications(
    {
      eventId: "closeout_package_accepted",
      actorUserId: input.actorUserId,
      projectId: input.projectId,
      relatedObjectType: "closeout_package",
      relatedObjectId: input.packageId,
      vars: {
        number: input.numberLabel,
        actorName: input.actorName ?? "The owner",
      },
    },
    dbc,
  );
}
