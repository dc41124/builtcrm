import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { getInspectionTemplate } from "@/domain/loaders/inspections";
import { AuthorizationError } from "@/domain/permissions";

import { TemplateDetailEditor } from "./editor";
import "../../../../../inspections.css";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const { session } = await requireServerSession();
  try {
    const template = await getInspectionTemplate({
      session: session,
      templateId,
    });
    return <TemplateDetailEditor template={template} />;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="in-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }
}
