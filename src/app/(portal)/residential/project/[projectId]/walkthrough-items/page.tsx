import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getResidentialWalkthroughItems,
  type ResidentialWalkthroughView,
} from "@/domain/loaders/punch-list";
import { AuthorizationError } from "@/domain/permissions";

import { WalkthroughItemsView } from "./walkthrough-view";

export default async function ResidentialWalkthroughItemsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let view: ResidentialWalkthroughView;
  try {
    view = await getResidentialWalkthroughItems({
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

  return <WalkthroughItemsView view={view} />;
}
