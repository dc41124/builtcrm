import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { organizations, projectUserMemberships, projects, users } from "@/db/schema";

async function main() {
  const projs = await db.select().from(projects);
  const orgs = await db.select().from(organizations);
  const us = await db.select().from(users);

  console.log("\n=== PROJECTS ===");
  for (const p of projs) {
    console.log(`  ${(p.projectCode ?? "").padEnd(14)}  ${p.id}  ·  ${p.name}`);
  }

  console.log("\n=== ORGANIZATIONS ===");
  for (const o of orgs) {
    console.log(`  ${o.organizationType.padEnd(16)}  ${o.id}  ·  ${o.name}`);
  }

  console.log("\n=== USERS (password: password123) ===");
  for (const u of us) {
    console.log(`  ${u.email.padEnd(48)}  ${u.id}`);
  }

  console.log("\n=== PROJECT MEMBERSHIPS ===");
  for (const p of projs) {
    console.log(`\n  ${p.name} (${p.projectCode ?? "—"}):`);
    const mems = await db
      .select({
        userId: projectUserMemberships.userId,
        orgId: projectUserMemberships.organizationId,
      })
      .from(projectUserMemberships)
      .where(eq(projectUserMemberships.projectId, p.id));
    for (const m of mems) {
      const u = us.find((x) => x.id === m.userId);
      const o = orgs.find((x) => x.id === m.orgId);
      console.log(`    - ${u?.email.padEnd(48)} @ ${o?.name} (${o?.organizationType})`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
