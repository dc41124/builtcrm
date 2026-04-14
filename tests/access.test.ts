import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { middleware } from "@/middleware";

import { IDS } from "./fixtures/seed";

const session = (userId: string | null) =>
  userId ? { appUserId: userId } : null;

describe("getEffectiveContext — project + role access", () => {
  it("resolves contractor admin on Project A", async () => {
    const ctx = await getEffectiveContext(
      session(IDS.users.contractorAdmin),
      IDS.projects.projectA,
    );
    expect(ctx.role).toBe("contractor_admin");
    expect(ctx.project.id).toBe(IDS.projects.projectA);
    expect(ctx.membership.source).toBe("project_user_membership");
  });

  it("resolves subcontractor on Project A", async () => {
    const ctx = await getEffectiveContext(
      session(IDS.users.subcontractor),
      IDS.projects.projectA,
    );
    expect(ctx.role).toBe("subcontractor_user");
  });

  it("resolves commercial client on Project A", async () => {
    const ctx = await getEffectiveContext(
      session(IDS.users.commercialClient),
      IDS.projects.projectA,
    );
    expect(ctx.role).toBe("commercial_client");
  });

  it("resolves residential client on Project A", async () => {
    const ctx = await getEffectiveContext(
      session(IDS.users.residentialClient),
      IDS.projects.projectA,
    );
    expect(ctx.role).toBe("residential_client");
  });

  it("contractor gets implicit access to Project B via org-staff fallback", async () => {
    const ctx = await getEffectiveContext(
      session(IDS.users.contractorAdmin),
      IDS.projects.projectB,
    );
    expect(ctx.role).toBe("contractor_admin");
    expect(ctx.membership.source).toBe("contractor_org_staff");
  });

  it.each([
    ["subcontractor", IDS.users.subcontractor],
    ["commercial client", IDS.users.commercialClient],
    ["residential client", IDS.users.residentialClient],
  ])("%s is blocked from Project B (no membership, no fallback)", async (_label, userId) => {
    await expect(
      getEffectiveContext(session(userId), IDS.projects.projectB),
    ).rejects.toMatchObject({
      name: "AuthorizationError",
      code: "forbidden",
    });
  });

  it("unauthenticated session is rejected", async () => {
    await expect(
      getEffectiveContext(null, IDS.projects.projectA),
    ).rejects.toMatchObject({
      name: "AuthorizationError",
      code: "unauthenticated",
    });
  });

  it("unknown project throws not_found", async () => {
    await expect(
      getEffectiveContext(
        session(IDS.users.contractorAdmin),
        "99999999-0000-0000-0000-000000000000",
      ),
    ).rejects.toMatchObject({
      name: "AuthorizationError",
      code: "not_found",
    });
  });

  it("AuthorizationError is its own class (not thrown as plain Error)", async () => {
    try {
      await getEffectiveContext(null, IDS.projects.projectA);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthorizationError);
    }
  });
});

describe("middleware — unauthenticated redirect", () => {
  it("redirects missing session to /login with next=path", () => {
    const req = new NextRequest("http://localhost/app/contractor", {
      headers: {},
    });
    const res = middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location")!;
    expect(location).toContain("/login");
    expect(location).toContain("next=%2Fapp%2Fcontractor");
  });

  it("lets requests with a session cookie through", () => {
    const req = new NextRequest("http://localhost/app/contractor", {
      headers: { cookie: "better-auth.session_token=fake" },
    });
    const res = middleware(req);
    // NextResponse.next() carries a special header, not a redirect.
    expect(res.headers.get("location")).toBeNull();
  });
});
