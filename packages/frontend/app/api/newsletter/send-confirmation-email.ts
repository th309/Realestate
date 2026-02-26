/**
 * Newsletter Confirmation Email
 *
 * Sends a double opt-in confirmation email via Resend API.
 * Falls back to console logging in dev when RESEND_API_KEY is not set.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM =
  process.env.EMAIL_FROM || "PropertyIQ <noreply@propertyiq.app>";

interface ConfirmationEmailParams {
  to: string;
  confirmationUrl: string;
}

function buildConfirmationHtml(confirmationUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
      <h2 style="font-size: 22px; color: #1a1a1a; margin-bottom: 16px;">Confirm your subscription</h2>
      <p style="font-size: 16px; color: #1a1a1a; line-height: 1.6;">
        Thanks for signing up for Weekly Market Insights from PropertyIQ!
      </p>
      <p style="font-size: 16px; color: #1a1a1a; line-height: 1.6;">
        Please confirm your email address by clicking the button below:
      </p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${confirmationUrl}" style="display: inline-block; padding: 14px 32px; background-color: #6B21A8; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Confirm Subscription
        </a>
      </p>
      <p style="font-size: 14px; color: #666; line-height: 1.6;">
        If you didn&rsquo;t sign up for this newsletter, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
      <p style="font-size: 12px; color: #999;">
        If the button doesn&rsquo;t work, copy and paste this link into your browser:
        <br />${confirmationUrl}
      </p>
    </div>
  `;
}

export async function sendConfirmationEmail(
  params: ConfirmationEmailParams,
): Promise<{ sent: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.log(
      `[DEV] Would send newsletter confirmation to ${params.to}: ${params.confirmationUrl}`,
    );
    return { sent: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [params.to],
        subject: "Confirm your PropertyIQ newsletter subscription",
        html: buildConfirmationHtml(params.confirmationUrl),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend API error (newsletter confirmation):", errorText);
      return { sent: false, error: `Email failed: ${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    console.error("Failed to send newsletter confirmation email:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
