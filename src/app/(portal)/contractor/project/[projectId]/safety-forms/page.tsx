import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { getContractorSafetyFormsWorkspace } from "@/domain/loaders/safety-forms";
import { AuthorizationError } from "@/domain/permissions";

import { SafetyFormsWorkspace } from "./workspace";
import "../../../../safety-forms.css";

export default async function ContractorSafetyFormsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();

  try {
    const view = await getContractorSafetyFormsWorkspace({
      session,
      projectId,
    });
    return <SafetyFormsWorkspace view={view} />;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="sf-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }
}
