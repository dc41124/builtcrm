import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { getSubSafetyFormsView } from "@/domain/loaders/safety-forms";
import { AuthorizationError } from "@/domain/permissions";
import "../../../../../../safety-forms.css";

import { SafetyFormWizard } from "./wizard";

export default async function SubSafetyFormNewPage({
  params,
}: {
  params: Promise<{ projectId: string; templateId: string }>;
}) {
  const { projectId, templateId } = await params;
  const { session } = await requireServerSession();

  let view;
  try {
    view = await getSubSafetyFormsView({ session, projectId });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="sf-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  const template = view.assignedTemplates.find((t) => t.id === templateId);
  if (!template) {
    redirect(`/subcontractor/project/${projectId}/safety-forms`);
  }

  return <SafetyFormWizard projectId={projectId} template={template} />;
}
