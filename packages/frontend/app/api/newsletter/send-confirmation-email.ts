/**
 * Newsletter Confirmation Email
 *
 * Sends a double opt-in confirmation email via Resend SDK with React Email template.
 * Falls back to console logging in dev when RESEND_API_KEY is not set.
 */

import { Resend } from "resend";
import { NewsletterConfirmation } from "@propertyiq/emails";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const rawFrom = process.env.EMAIL_FROM || "PropertyIQ <noreply@propertyiq.app>";
const EMAIL_FROM = rawFrom.includes("<")
  ? rawFrom
  : `PropertyIQ <${rawFrom.trim()}>`;

interface ConfirmationEmailParams {
  to: string;
  confirmationUrl: string;
}

export async function sendConfirmationEmail(
  params: ConfirmationEmailParams,
): Promise<{ sent: boolean; error?: string }> {
  if (!resend) {
    console.log(
      `[DEV] Would send newsletter confirmation to ${params.to}: ${params.confirmationUrl}`,
    );
    return { sent: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [params.to],
      subject: "Confirm your PropertyIQ newsletter subscription",
      react: NewsletterConfirmation({ confirmUrl: params.confirmationUrl }),
    });

    if (error) {
      console.error("Resend SDK error (newsletter):", error);
      return { sent: false, error: `Email failed: ${error.message}` };
    }

    return { sent: true };
  } catch (error) {
    console.error("Failed to send newsletter confirmation:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
