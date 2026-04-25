// Email stub for "your data export is ready" — same console-log pattern
// as src/lib/user-deletion/email.ts. Replace with a real provider
// before EU/CA launch. See docs/specs/user_deletion_and_export_plan.md.

export async function sendDataExportReadyEmail(input: {
  toEmail: string;
  downloadUrl: string;
  expiresAt: Date;
}): Promise<void> {
  console.log(
    `[user-export] Export ready email to ${input.toEmail}\n` +
      `  Download: ${input.downloadUrl}\n` +
      `  Expires: ${input.expiresAt.toISOString()}`,
  );
}
