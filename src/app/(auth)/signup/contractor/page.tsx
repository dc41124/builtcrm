import { redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";

import { ContractorSignupFlow } from "./signup-contractor-form";

// Public self-serve contractor signup. Invitation-based signups (team, sub,
// client) stay on /signup?token=… — those bypass billing entirely. This
// route is paywalled: the flow completes only after Stripe Checkout
// succeeds (webhook creates the subscription row).
export default async function ContractorSignupPage() {
  const sessionData = await getServerSession();
  if (sessionData) {
    // Already signed in — send them home. If they want a second org, they
    // need to sign out first.
    redirect("/");
  }

  return (
    <div className="auth-card wide">
      <div className="auth-card-body">
        <h2>Start your free trial</h2>
        <p className="auth-sub">
          14 days free, card required. Cancel anytime during the trial and we
          won&apos;t charge you.
        </p>
        <ContractorSignupFlow />
      </div>
    </div>
  );
}
