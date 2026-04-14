import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { drawRequests, lienWaivers } from "@/db/schema";

import { handleDrawTransition } from "@/app/api/draw-requests/[id]/_transition";

import { IDS, resetDrawToDraft } from "./fixtures/seed";
import { auditEventsFor } from "./helpers/audit";
import { jsonRequest } from "./helpers/request";
import { ASSUME } from "./helpers/session";

type TransitionKind = Parameters<typeof handleDrawTransition>[2];

async function transition(kind: TransitionKind, body: unknown = {}) {
  return handleDrawTransition(jsonRequest(body), IDS.draw.projectA, kind);
}

async function currentStatus(): Promise<string> {
  const [row] = await db
    .select({ status: drawRequests.drawRequestStatus })
    .from(drawRequests)
    .where(eq(drawRequests.id, IDS.draw.projectA))
    .limit(1);
  return row.status;
}

async function acceptWaiver(kind: "conditional_progress" | "unconditional_progress") {
  await db
    .update(lienWaivers)
    .set({ lienWaiverStatus: "accepted", acceptedAt: new Date() })
    .where(
      and(
        eq(lienWaivers.drawRequestId, IDS.draw.projectA),
        eq(lienWaivers.lienWaiverType, kind),
      ),
    );
}

beforeEach(async () => {
  await resetDrawToDraft();
});

describe("draw request state machine — valid path", () => {
  it("walks draft → submitted → under_review → approved → paid", async () => {
    ASSUME.contractor();
    let res = await transition("submit");
    expect(res.status).toBe(200);
    expect(await currentStatus()).toBe("submitted");

    ASSUME.contractor();
    res = await transition("start-review");
    expect(res.status).toBe(200);
    expect(await currentStatus()).toBe("under_review");

    ASSUME.commercial();
    res = await transition("approve");
    expect(res.status).toBe(200);
    expect(await currentStatus()).toBe("approved");

    // Conditional waiver was auto-created on submit — accept it so
    // mark-paid isn't blocked by the waiver gate.
    await acceptWaiver("conditional_progress");

    ASSUME.contractor();
    res = await transition("mark-paid", { paymentReferenceName: "CHECK #1001" });
    expect(res.status).toBe(200);
    expect(await currentStatus()).toBe("paid");

    // Audit trail: expect one event per transition (4 total).
    const events = await auditEventsFor("draw_request", IDS.draw.projectA);
    const actions = events.map((e) => e.action);
    expect(actions).toEqual([
      "submitted",
      "under review",
      "approved",
      "marked paid",
    ]);
  });
});

describe("draw request state machine — invalid transitions", () => {
  it("rejects draft → approved (skipping submit)", async () => {
    ASSUME.commercial();
    const res = await transition("approve");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("invalid_state");
    expect(await currentStatus()).toBe("draft");
  });

  it("rejects mark-paid on a draft", async () => {
    ASSUME.contractor();
    const res = await transition("mark-paid", { paymentReferenceName: "X" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("invalid_state");
  });

  it("rejects submit on an already-submitted draw", async () => {
    ASSUME.contractor();
    await transition("submit");
    const res = await transition("submit");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("invalid_state");
  });
});

describe("draw request state machine — role enforcement", () => {
  it("subcontractor cannot submit a draw", async () => {
    ASSUME.subcontractor();
    const res = await transition("submit");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
  });

  it("subcontractor cannot approve a draw", async () => {
    // Push to under_review first.
    ASSUME.contractor();
    await transition("submit");
    await transition("start-review");

    ASSUME.subcontractor();
    const res = await transition("approve");
    expect(res.status).toBe(403);
  });

  it("client cannot submit a draw", async () => {
    ASSUME.commercial();
    const res = await transition("submit");
    expect(res.status).toBe(403);
  });

  it("client can approve, contractor cannot", async () => {
    ASSUME.contractor();
    await transition("submit");
    await transition("start-review");

    ASSUME.contractor();
    const blocked = await transition("approve");
    expect(blocked.status).toBe(403);

    ASSUME.commercial();
    const ok = await transition("approve");
    expect(ok.status).toBe(200);
  });

  it("client can return a draw under review", async () => {
    ASSUME.contractor();
    await transition("submit");
    await transition("start-review");

    ASSUME.commercial();
    const res = await transition("return", { reason: "Needs more backup" });
    expect(res.status).toBe(200);
    expect(await currentStatus()).toBe("returned");
  });
});

describe("draw request — lien waiver gate on mark-paid", () => {
  it("blocks mark-paid when conditional waiver has not been accepted", async () => {
    ASSUME.contractor();
    await transition("submit");
    await transition("start-review");

    ASSUME.commercial();
    await transition("approve");

    // Do NOT accept the auto-created conditional waiver.
    ASSUME.contractor();
    const res = await transition("mark-paid", { paymentReferenceName: "CHECK #1002" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("lien_waiver_required");
    expect(await currentStatus()).toBe("approved");
  });

  it("allows mark-paid once the waiver is accepted", async () => {
    ASSUME.contractor();
    await transition("submit");
    await transition("start-review");
    ASSUME.commercial();
    await transition("approve");
    await acceptWaiver("conditional_progress");

    ASSUME.contractor();
    const res = await transition("mark-paid", { paymentReferenceName: "CHECK #1003" });
    expect(res.status).toBe(200);
    expect(await currentStatus()).toBe("paid");
  });
});

describe("draw request — audit events", () => {
  it("writes an audit event on every state change", async () => {
    ASSUME.contractor();
    await transition("submit");
    ASSUME.contractor();
    await transition("start-review");

    const events = await auditEventsFor("draw_request", IDS.draw.projectA);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      action: "submitted",
      actorUserId: IDS.users.contractorAdmin,
    });
    expect(events[1].action).toBe("under review");
    // Transition engine records previous/next state in details.
    expect((events[0].previousState as { status: string }).status).toBe("draft");
    expect((events[0].nextState as { status: string }).status).toBe("submitted");
  });
});
