import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  try {
    const template = await getInspectionTemplate({
      session: session.session as unknown as { appUserId?: string | null },
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
