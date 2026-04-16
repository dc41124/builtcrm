import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getResidentialSelections,
  type ResidentialSelectionsView,
} from "@/domain/loaders/selections";
import { AuthorizationError } from "@/domain/permissions";

import { ResidentialSelectionsReview } from "../selections/selections-review";

export default async function ConfirmedChoicesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view: ResidentialSelectionsView;
  try {
    view = await getResidentialSelections({
      session: session.session as unknown as { appUserId?: string | null },
      projectId,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return (
    <ResidentialSelectionsReview
      projectName={view.project.name}
      categories={view.categories}
      totals={view.totals}
      initialTab="confirmed"
    />
  );
}
