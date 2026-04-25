import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getResidentialJournalPageView,
  type ResidentialJournalPageView,
} from "@/domain/loaders/residential-journal-page";
import { AuthorizationError } from "@/domain/permissions";

import { ResidentialJournalWorkspace } from "./journal-workspace";

export default async function ResidentialJournalPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let view: ResidentialJournalPageView;
  try {
    view = await getResidentialJournalPageView({
      session: session,
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

  return <ResidentialJournalWorkspace view={view} />;
}
