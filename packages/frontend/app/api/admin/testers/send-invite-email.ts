/**
 * Beta Tester Invite Email
 *
 * Sends invite email via Resend SDK with React Email template.
 * Checks Supabase auth to determine if the tester already has an account.
 * - Has account: email with feedback link only
 * - No account: email with sign-up link + feedback link
 *
 * Falls back to console logging in dev.
 */

import { Resend } from "resend";
import { BetaInvite } from "@propertyiq/emails";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicSiteUrl, isLocalhostUrl } from "@/lib/config/site-url";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM = process.env.EMAIL_FROM || "Troy <troy@propertyiq.app>";

interface InviteEmailParams {
  to: string;
  name: string;
  token: string;
}

async function hasSupabaseAccount(email: string): Promise<boolean> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    if (error) {
      console.error("Error checking user account:", error);
      // Default to including sign-up link if we can't check
      return false;
    }

    // listUsers doesn't support email filter directly, so query user_profiles
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    return !!profile;
  } catch (error) {
    console.error("Account lookup failed:", error);
    return false;
  }
}

export async function sendInviteEmail(
  params: InviteEmailParams,
): Promise<{ sent: boolean; error?: string }> {
  // Invite links always point to the live site — never a developer's localhost,
  // even when this runs from a local dev server (see lib/config/site-url.ts).
  const appUrl = getPublicSiteUrl();
  const testingUrl = `${appUrl}/betatest/${params.token}`;

  // Defense-in-depth: never email a real recipient an unreachable localhost link.
  if (resend && isLocalhostUrl(testingUrl)) {
    return {
      sent: false,
      error: "Refusing to send a beta invite with a localhost URL.",
    };
  }

  // Check if tester already has an account
  const accountExists = await hasSupabaseAccount(params.to);
  const signUpUrl = accountExists ? undefined : `${appUrl}/auth/sign-up`;

  if (!resend) {
    console.log(
      `[DEV] Would send beta invite to ${params.to}: ${testingUrl}` +
        (signUpUrl
          ? ` (includes sign-up link: ${signUpUrl})`
          : " (existing user)"),
    );
    return { sent: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [params.to],
      subject: "You're invited to beta test PropertyIQ",
      react: BetaInvite({ name: params.name, testingUrl, signUpUrl }),
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
