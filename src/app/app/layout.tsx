import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, resolvePortalPath } from "@/auth/config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return <>{children}</>;
}

export async function resolveAndRedirectToPortal() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const s = session.session as unknown as {
    portalType: string | null;
    clientSubtype: string | null;
  };
  redirect(resolvePortalPath(s));
}
