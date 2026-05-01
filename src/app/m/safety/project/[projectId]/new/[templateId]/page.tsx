import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { getSubSafetyFormsView } from "@/domain/loaders/safety-forms";
import { AuthorizationError } from "@/domain/permissions";

import { MobileSafetyFormWizard } from "./mobile-wizard";
import "../../../../m-safety.css";
// FieldRenderer outputs `.sf-*` class names; pull in the desktop CSS
// so the renderer picks up the right widths/colors on the mobile route.
import "@/app/(portal)/safety-forms.css";

export default async function MobileSafetyFormNewPage({
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
      return (
        <div style={{ padding: 24, fontSize: 13, color: "#c93b3b" }}>
          Forbidden: {err.message}
        </div>
      );
    }
    throw err;
  }

  const template = view.assignedTemplates.find((t) => t.id === templateId);
  if (!template) redirect(`/m/safety/project/${projectId}`);

  return (
    <MobileSafetyFormWizard projectId={projectId} template={template} />
  );
}
