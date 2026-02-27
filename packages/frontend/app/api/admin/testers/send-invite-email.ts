/**
 * Beta Tester Invite Email
 *
 * Sends invite email via Resend SDK with React Email template.
 * Falls back to console logging in dev.
 */

import { Resend } from "resend";
import { BetaInvite } from "@propertyiq/emails";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM = process.env.EMAIL_FROM || "Troy <troy@propertyiq.app>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface InviteEmailParams {
  to: string;
  name: string;
  token: string;
}

export async function sendInviteEmail(
  params: InviteEmailParams,
): Promise<{ sent: boolean; error?: string }> {
  const testingUrl = `${APP_URL}/betatest/${params.token}`;

  if (!resend) {
    console.log(`[DEV] Would send beta invite to ${params.to}: ${testingUrl}`);
    return { sent: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [params.to],
      subject: "You're invited to beta test PropertyIQ",
      react: BetaInvite({ name: params.name, testingUrl }),
    });

    if (error) {
      console.error("Resend SDK error:", error);
      return { sent: false, error: `Email failed: ${error.message}` };
    }

    return { sent: true };
  } catch (error) {
    console.error("Failed to send invite email:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
