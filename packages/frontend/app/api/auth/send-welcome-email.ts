/**
 * Welcome Email
 *
 * Sends a welcome email to first-time signups via Resend SDK with React Email template.
 * Falls back to console logging in dev when RESEND_API_KEY is not set.
 */

import { Resend } from "resend";
import { WelcomeEmail } from "@propertyiq/emails";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM =
  process.env.EMAIL_FROM || "PropertyIQ <noreply@propertyiq.app>";

interface WelcomeEmailParams {
  to: string;
  name: string;
  loginUrl: string;
}

export async function sendWelcomeEmail(
  params: WelcomeEmailParams,
): Promise<{ sent: boolean; error?: string }> {
  if (!resend) {
    console.log(`[DEV] Would send welcome email to ${params.to}`);
    return { sent: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [params.to],
      subject: "Welcome to PropertyIQ",
      react: WelcomeEmail({ name: params.name, loginUrl: params.loginUrl }),
    });

    if (error) {
      console.error("Resend SDK error (welcome):", error);
      return { sent: false, error: `Email failed: ${error.message}` };
    }

    return { sent: true };
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
