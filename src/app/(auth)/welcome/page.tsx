import Link from "next/link";

import { resolvePortalPath } from "@/auth/config";
import { loadInvitationByToken } from "@/domain/loaders/invitations";
import { AuthorizationError } from "@/domain/permissions";

type Search = Promise<{ token?: string }>;

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { token } = await searchParams;
  if (!token) {
    return <FallbackWelcome />;
  }

  let invitation;
  try {
    invitation = await loadInvitationByToken(token);
  } catch (err) {
    if (err instanceof AuthorizationError) return <FallbackWelcome />;
    throw err;
  }

  const isResidential =
    invitation.portalType === "client" &&
    invitation.clientSubtype === "residential";

  const portalPath = resolvePortalPath({
    portalType: invitation.portalType,
    clientSubtype: invitation.clientSubtype,
  });
  const projectHref = invitation.project
    ? `${portalPath}/project/${invitation.project.id}`
    : portalPath;

  const firstName = (invitation.invitedName ?? invitation.invitedEmail).split(
    /\s+|@/,
  )[0];

  return (
    <div className="auth-card wide">
      <div className="step-indicator">
        <div className="step-dot done"></div>
        <div className="step-dot done"></div>
        <div className={isResidential ? "step-dot active res" : "step-dot active"}></div>
      </div>
      <div className="auth-card-body">
        <h2>Welcome, {firstName}</h2>
        <p className="auth-sub">
          {isResidential
            ? "Here's what you can do from your project portal."
            : `Here's what you can do${
                invitation.project ? ` on ${invitation.project.name}` : ""
              }.`}
        </p>

        <div className="welcome-features">
          {isResidential ? (
            <>
              <Feature
                tone="teal"
                title="Choose your finishes"
                body="Browse curated options for flooring, paint, hardware, and more — then confirm your choices when you're ready."
              />
              <Feature
                tone="green"
                title="See your home being built"
                body="Your builder will share progress photos and updates so you always know where things stand."
              />
              <Feature
                tone="blue"
                title="Talk to your builder"
                body="Message your project team directly with questions, feedback, or ideas."
              />
            </>
          ) : (
            <>
              <Feature
                tone="purple"
                title="Review and approve"
                body="Approve change orders, review billing draws, and sign off on project decisions."
              />
              <Feature
                tone="blue"
                title="Track financials"
                body="See payment history, current draws, retainage, and your contract status at a glance."
              />
              <Feature
                tone="green"
                title="Monitor progress"
                body="View milestones, progress photos, and project updates from your contractor."
              />
            </>
          )}
        </div>

        <Link
          href={projectHref}
          className={`btn-auth ${isResidential ? "residential" : ""}`}
          style={{ textDecoration: "none" }}
        >
          {isResidential ? "See your project →" : "Go to your project →"}
        </Link>
      </div>
    </div>
  );
}

function Feature({
  tone,
  title,
  body,
}: {
  tone: "purple" | "teal" | "blue" | "green";
  title: string;
  body: string;
}) {
  return (
    <div className="welcome-feature">
      <div className={`welcome-icon ${tone}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="m8 12 3 3 5-5" />
        </svg>
      </div>
      <div>
        <h4>{title}</h4>
        <p>{body}</p>
      </div>
    </div>
  );
}

function FallbackWelcome() {
  return (
    <div className="auth-card">
      <h2>Welcome to BuiltCRM</h2>
      <p className="auth-sub">Your account is ready.</p>
      <Link
        href="/"
        className="btn-auth"
        style={{ textDecoration: "none" }}
      >
        Continue
      </Link>
    </div>
  );
}
