// Email stubs for the account-deletion lifecycle. Same dev-only pattern
// as src/auth/config.ts `sendResetPassword`: log the message to the
// console so a local developer can step through the flow. Replace with
// a real provider (Postmark / SendGrid via the integration registry)
// before the EU/CA launch.
//
// See docs/specs/user_deletion_and_export_plan.md §6 q1.

import { env } from "@/lib/env";

export async function sendDeletionConfirmationEmail(input: {
  toEmail: string;
  cancelToken: string;
  scheduledForAnonymizationAt: Date;
}): Promise<void> {
  const cancelUrl = `${env.BETTER_AUTH_URL}/api/user/cancel-deletion?token=${encodeURIComponent(
    input.cancelToken,
  )}`;
  console.log(
    `[user-deletion] Confirmation email to ${input.toEmail}\n` +
      `  Account scheduled for anonymization on ${input.scheduledForAnonymizationAt.toISOString()}.\n` +
      `  Cancel link (valid until that date): ${cancelUrl}`,
  );
}

export async function sendDeletionReminderEmail(input: {
  toEmail: string;
  cancelToken: string;
  scheduledForAnonymizationAt: Date;
}): Promise<void> {
  const cancelUrl = `${env.BETTER_AUTH_URL}/api/user/cancel-deletion?token=${encodeURIComponent(
    input.cancelToken,
  )}`;
  console.log(
    `[user-deletion] 7-day reminder to ${input.toEmail}\n` +
      `  Account anonymizes on ${input.scheduledForAnonymizationAt.toISOString()}.\n` +
      `  Cancel link: ${cancelUrl}`,
  );
}
