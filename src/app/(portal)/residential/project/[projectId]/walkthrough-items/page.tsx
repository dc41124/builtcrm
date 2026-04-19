import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view: ResidentialWalkthroughView;
  try {
    view = await getResidentialWalkthroughItems({
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

  return <WalkthroughItemsView view={view} />;
}
