import { redirect } from "next/navigation";

import {
  isInvitationAcceptable,
  loadInvitationByToken,
} from "@/domain/loaders/invitations";
import { AuthorizationError } from "@/domain/permissions";

import { SignupForm } from "./signup-form";

type Search = Promise<{ token?: string }>;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { token } = await searchParams;

  if (!token) {
    // Self-serve signup is intentionally disabled — this is an
    // invitation-only product. Redirect curious visitors to login.
    redirect("/login");
  }

  let invitation;
  try {
    invitation = await loadInvitationByToken(token);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      redirect("/login");
    }
    throw err;
  }

  const status = isInvitationAcceptable(invitation);
  if (!status.ok) {
    redirect(`/invite/${token}`);
  }

  const isResidential =
    invitation.portalType === "client" &&
    invitation.clientSubtype === "residential";
  const orgName = invitation.organization.name;
  const projectName = invitation.project?.name ?? null;

  return (
    <div className="auth-card wide">
      <div className="step-indicator">
        <div className="step-dot done"></div>
        <div className={isResidential ? "step-dot active res" : "step-dot active"}></div>
        <div className="step-dot"></div>
      </div>
      <div className="auth-card-body">
        <h2>{isResidential ? "Set up your account" : "Create your account"}</h2>
        <p className="auth-sub">
          {isResidential
            ? "This will be your personal login to see updates, make selections, and stay connected with your builder."
            : `Set up your account to access ${projectName ?? orgName}.`}
        </p>
        <SignupForm
          token={token}
          email={invitation.invitedEmail}
          isResidential={isResidential}
          showCompanyField={!isResidential}
        />
      </div>
    </div>
  );
}
