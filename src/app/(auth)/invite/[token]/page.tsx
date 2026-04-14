import Link from "next/link";

import {
  isInvitationAcceptable,
  loadInvitationByToken,
  type InvitationView,
} from "@/domain/loaders/invitations";
import { AuthorizationError } from "@/domain/permissions";

type Params = Promise<{ token: string }>;

export default async function InvitePage({ params }: { params: Params }) {
  const { token } = await params;

  let invitation: InvitationView;
  try {
    invitation = await loadInvitationByToken(token);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return <InvalidInvite reason="not_found" />;
    }
    throw err;
  }

  const status = isInvitationAcceptable(invitation);
  if (!status.ok) {
    return <InvalidInvite reason={status.reason ?? "expired"} />;
  }

  const isResidential =
    invitation.portalType === "client" &&
    invitation.clientSubtype === "residential";
  const accentClass = isResidential ? "residential" : "";
  const stepClass = isResidential ? "step-dot active res" : "step-dot active";
  const inviterName = invitation.inviter.displayName ?? invitation.inviter.email;
  const orgName = invitation.organization.name;
  const friendlyRole = friendlyRoleLabel(invitation.roleKey);

  const signupHref = `/signup?token=${encodeURIComponent(invitation.token)}`;
  const loginHref = `/login?next=${encodeURIComponent(`/invite/${invitation.token}`)}`;

  return (
    <div className={`auth-card wide`}>
      <div className="step-indicator">
        <div className={stepClass}></div>
        <div className="step-dot"></div>
        <div className="step-dot"></div>
      </div>
      <div className="auth-card-body">
        {isResidential ? (
          <>
            <h1>Your home project is ready</h1>
            <p className="auth-sub">
              {inviterName} at {orgName} has set up a project portal for your
              home renovation.
            </p>
          </>
        ) : (
          <>
            <h1>You&apos;ve been invited to a project</h1>
            <p className="auth-sub">
              {orgName} has invited you to collaborate on a construction
              project through BuiltCRM.
            </p>
          </>
        )}

        <div className={`project-context ${isResidential ? "residential" : ""}`}>
          <div className="project-context-label">
            {invitation.project ? "Project" : "Organization"}
          </div>
          <h3>{invitation.project?.name ?? orgName}</h3>
          {invitation.project ? (
            <p>
              Status: {invitation.project.projectStatus.replace("_", " ")}
            </p>
          ) : (
            <p>You&apos;re being added at the organization level.</p>
          )}
          <div className="project-context-meta">
            <span>
              <strong>Invited by:</strong> {inviterName}
            </span>
            <span>
              <strong>Your role:</strong> {friendlyRole}
            </span>
          </div>
          {invitation.personalMessage ? (
            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                color: "var(--text-secondary)",
                fontStyle: "italic",
              }}
            >
              &ldquo;{invitation.personalMessage}&rdquo;
            </p>
          ) : null}
        </div>

        <Link
          href={signupHref}
          className={`btn-auth ${accentClass}`}
          style={{ textDecoration: "none" }}
        >
          {isResidential ? "Get started" : "Accept invitation"}
        </Link>
        <div className="divider">or</div>
        <Link
          href={loginHref}
          className="btn-auth secondary"
          style={{ textDecoration: "none" }}
        >
          I already have an account — sign in
        </Link>

        <div
          style={{
            marginTop: 16,
            textAlign: "center",
            fontSize: 12,
            color: "var(--text-tertiary)",
          }}
        >
          By accepting, you agree to the Terms of Service and Privacy Policy.
        </div>
      </div>
    </div>
  );
}

function InvalidInvite({
  reason,
}: {
  reason: "not_found" | "already_accepted" | "expired" | "revoked";
}) {
  const messages: Record<typeof reason, { title: string; body: string }> = {
    not_found: {
      title: "Invitation not found",
      body: "This invitation link is invalid or has already been removed.",
    },
    already_accepted: {
      title: "Invitation already accepted",
      body: "You can sign in to access your project.",
    },
    expired: {
      title: "Invitation expired",
      body: "This invitation has expired. Ask the sender to send a new one.",
    },
    revoked: {
      title: "Invitation revoked",
      body: "This invitation was revoked by the sender.",
    },
  };
  const m = messages[reason];
  return (
    <div className="auth-card">
      <h2>{m.title}</h2>
      <p className="auth-sub">{m.body}</p>
      <Link
        href="/login"
        className="btn-auth secondary"
        style={{ textDecoration: "none" }}
      >
        Go to sign in
      </Link>
    </div>
  );
}

function friendlyRoleLabel(roleKey: string): string {
  return roleKey
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
