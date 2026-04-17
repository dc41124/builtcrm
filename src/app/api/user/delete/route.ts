import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth/config";

// Stub endpoint for account deletion. Real deletion cascades across org
// memberships, outstanding invoices, and audit trails — tracked as a
// separate workstream. For now the UI opens a "contact support" modal and
// never calls this endpoint, but it exists so the route is reserved and a
// smoke-test can confirm the auth gate works.
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  return NextResponse.json(
    {
      error: "not_implemented",
      message:
        "Account deletion is not yet self-serve. Contact support@builtcrm.com to delete your account.",
    },
    { status: 501 },
  );
}
