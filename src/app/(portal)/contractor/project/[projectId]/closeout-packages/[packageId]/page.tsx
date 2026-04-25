import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getCloseoutPackage,
  getProjectDocumentLibrary,
} from "@/domain/loaders/closeout-packages";
import { AuthorizationError } from "@/domain/permissions";

import "../../../../../closeout-packages.css";
import { CloseoutBuilder } from "./builder";

export default async function ContractorCloseoutPackageDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; packageId: string }>;
}) {
  const { projectId, packageId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const sessionLike = session.session as unknown as {
    appUserId?: string | null;
  };

  try {
    const [pkg, lib] = await Promise.all([
      getCloseoutPackage({ session: sessionLike, packageId }),
      getProjectDocumentLibrary({ session: sessionLike, projectId }),
    ]);

    return (
      <div className="cp-content cp-content-builder">
        <CloseoutBuilder
          projectId={projectId}
          pkg={pkg}
          docLibrary={lib.folders}
        />
      </div>
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return (
        <div className="cp-content">
          <pre>Forbidden: {err.message}</pre>
        </div>
      );
    }
    throw err;
  }
}
