// Smoke test for notifications RLS:
//   - With user-A's GUC: user-A sees their notifications, count > 0
//   - With user-B's GUC: user-A's notifications NOT visible (count for A = 0)
//   - With NO user GUC set: nullif coerces '' -> NULL, query returns 0 (no error)
import postgres from "postgres";

const adminUrl = process.env.DATABASE_ADMIN_URL;
const appUrl = process.env.DATABASE_URL;
if (!adminUrl || !appUrl) {
  throw new Error("DATABASE_ADMIN_URL and DATABASE_URL must both be set");
}
const admin = postgres(adminUrl, { max: 1 });
const app = postgres(appUrl, { max: 1 });

// Pick a user with notifications, and another user with notifications.
const rows = await admin`
  SELECT recipient_user_id, count(*)::int AS n
  FROM notifications
  GROUP BY recipient_user_id
  ORDER BY count(*) DESC
  LIMIT 2
`;
if (rows.length < 1) {
  console.log("No notifications in seed — emit one and rerun");
  await admin.end();
  await app.end();
  process.exit(0);
}
const userA = rows[0].recipient_user_id;
const userB = rows.length > 1 ? rows[1].recipient_user_id : "00000000-0000-0000-0000-000000000000";
console.log(`userA=${userA} (${rows[0].n} notifications)`);
console.log(`userB=${userB}${rows.length > 1 ? ` (${rows[1].n} notifications)` : " (synthetic)"}`);

const [orgRow] = await admin`SELECT id FROM organizations ORDER BY id LIMIT 1`;
const orgId = orgRow.id;

async function countForUserAWithGuc(userGuc) {
  return app.begin(async (tx) => {
    await tx`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    if (userGuc !== null) {
      await tx`SELECT set_config('app.current_user_id', ${userGuc}, true)`;
    }
    const r = await tx`SELECT count(*)::int AS c FROM notifications WHERE recipient_user_id = ${userA}`;
    return r[0].c;
  });
}

const ownView = await countForUserAWithGuc(userA);
const otherView = await countForUserAWithGuc(userB);
const noGucView = await countForUserAWithGuc(null);

const totalForA = rows[0].n;
console.log(``);
console.log(`Own GUC (userA):  visible=${ownView}  expected=${totalForA}  ${ownView === totalForA ? "OK" : "FAIL"}`);
console.log(`Other GUC (userB): visible=${otherView}  expected=0  ${otherView === 0 ? "OK" : "FAIL"}`);
console.log(`No GUC set:        visible=${noGucView}  expected=0  ${noGucView === 0 ? "OK" : "FAIL"}`);

const allOk = ownView === totalForA && otherView === 0 && noGucView === 0;

await admin.end();
await app.end();
process.exit(allOk ? 0 : 1);
