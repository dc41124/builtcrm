import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  authSession,
  auditEvents,
  organizations,
  organizationUsers,
  roleAssignments,
  users,
} from "@/db/schema";

// Contractor self-serve signup bootstrap. Runs AFTER Better Auth's
// signUp.email has created the user + session. Creates the matching domain
// records (org, membership, role) and promotes the session's additional
// fields so portal routing works on the very next request (no
// log-out-and-back-in UX).
//
// Auth-adjacent but does NOT touch src/auth/config.ts — it just writes the
// same additional fields Better Auth itself populates at session.create time.
//
// Refuses to run if the caller already has any role assignment — prevents
// double-bootstrap / accidental second-org creation.

const BodySchema = z.object({
  companyName: z.string().trim().min(1).max(255),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const sessionShim = session.session as unknown as {
    id?: string;
    appUserId?: string | null;
  };
  const appUserId = sessionShim.appUserId;
  const sessionId = sessionShim.id;
  if (!appUserId || !sessionId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Block anyone who already has a role — avoids accidentally creating a
  // second contractor org on replay / duplicate submit.
  const [existingRole] = await db
    .select({ id: roleAssignments.id })
    .from(roleAssignments)
    .where(eq(roleAssignments.userId, appUserId))
    .limit(1);
  if (existingRole) {
    return NextResponse.json(
      { error: "already_provisioned" },
      { status: 409 },
    );
  }

  const [userRow] = await db
    .select({ email: users.email, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, appUserId))
    .limit(1);
  if (!userRow) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const result = await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        name: parsed.data.companyName,
        organizationType: "contractor",
      })
      .returning({ id: organizations.id });

    await tx.insert(organizationUsers).values({
      organizationId: org.id,
      userId: appUserId,
      membershipStatus: "active",
    });

    await tx.insert(roleAssignments).values({
      userId: appUserId,
      organizationId: org.id,
      portalType: "contractor",
      roleKey: "contractor_admin",
      isPrimary: true,
    });

    // Promote the current session's denormalized fields so portal routing
    // works immediately. Targets only the caller's session row; other
    // devices log in fresh and run the session.create hook normally.
    await tx
      .update(authSession)
      .set({
        appUserId,
        organizationId: org.id,
        role: "contractor_admin",
        portalType: "contractor",
        clientSubtype: null,
      })
      .where(
        and(eq(authSession.id, sessionId), eq(authSession.appUserId, appUserId)),
      );

    await tx.insert(auditEvents).values({
      actorUserId: appUserId,
      organizationId: org.id,
      objectType: "organization",
      objectId: org.id,
      actionName: "created",
      nextState: { flow: "self_serve_signup", name: parsed.data.companyName },
    });

    return { organizationId: org.id };
  });

  return NextResponse.json({ ok: true, organizationId: result.organizationId });
}
