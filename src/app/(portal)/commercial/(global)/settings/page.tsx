import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getUserSettingsView } from "@/domain/loaders/user-settings";
import { AuthorizationError } from "@/domain/permissions";
import { SettingsShell } from "@/components/settings/settings-shell";

export default async function CommercialSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view;
  try {
    view = await getUserSettingsView({
      session: session.session as unknown as { appUserId?: string | null },
      sessionId: (session.session as { id?: string }).id,
      portalType: "commercial",
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1
          style={{
            fontFamily: "'DM Sans',system-ui,sans-serif",
            fontSize: 26,
            fontWeight: 750,
            letterSpacing: "-.03em",
            margin: 0,
          }}
        >
          Settings
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--t2)",
            marginTop: 4,
            marginBottom: 0,
            fontWeight: 520,
            lineHeight: 1.5,
            maxWidth: 680,
          }}
        >
          Manage your profile, security, notifications, and appearance.
        </p>
      </div>
      <SettingsShell view={view} />
    </div>
  );
}
