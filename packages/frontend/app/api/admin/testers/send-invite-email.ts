/**
 * Beta Tester Invite Email
 *
 * Sends invite email via Resend API. Falls back to console logging in dev.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Troy <troy@propertyiq.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface InviteEmailParams {
  to: string;
  name: string;
  token: string;
}

function buildInviteHtml(name: string, link: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
      <p style="font-size: 16px; color: #1a1a1a;">Hey ${name},</p>
      <p style="font-size: 16px; color: #1a1a1a; line-height: 1.6;">
        Troy here &mdash; I&rsquo;d love your help testing PropertyIQ, a real estate analytics platform I&rsquo;m building.
      </p>
      <p style="font-size: 16px; color: #1a1a1a; line-height: 1.6;">
        Click the link below to access the app and submit feedback directly:
      </p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${link}" style="display: inline-block; padding: 14px 32px; background-color: #6B21A8; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Start Testing
        </a>
      </p>
      <p style="font-size: 14px; color: #666; line-height: 1.6;">
        Your feedback link is unique to you &mdash; no login needed. Just use it whenever you want to report bugs, suggest features, or share thoughts.
      </p>
      <p style="font-size: 16px; color: #1a1a1a;">
        Thanks for helping make PropertyIQ better!
      </p>
      <p style="font-size: 16px; color: #1a1a1a;">&mdash; Troy</p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
      <p style="font-size: 12px; color: #999;">
        If the button doesn&rsquo;t work, copy this link: ${link}
      </p>
    </div>
  `;
}

export async function sendInviteEmail(
  params: InviteEmailParams,
): Promise<{ sent: boolean; error?: string }> {
  const link = `${APP_URL}/betatest/${params.token}`;

  if (!RESEND_API_KEY) {
    console.log(`[DEV] Would send beta invite to ${params.to}: ${link}`);
    return { sent: true };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [params.to],
        subject: "You're invited to beta test PropertyIQ",
        html: buildInviteHtml(params.name, link),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API error:', errorText);
      return { sent: false, error: `Email failed: ${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    console.error('Failed to send invite email:', error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
