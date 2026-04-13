import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth/config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return <>{children}</>;
}
