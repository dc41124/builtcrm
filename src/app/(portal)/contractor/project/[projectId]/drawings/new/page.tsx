import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

import "../drawings.css";
import { UploadWorkspace } from "./workspace";

export default async function ContractorDrawingsUploadPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  try {
    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      projectId,
    );
    if (!ctx.permissions.can("drawing", "write")) {
      return <pre>Forbidden: only contractor staff can upload sheet sets.</pre>;
    }
    return <UploadWorkspace projectId={projectId} />;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }
}
