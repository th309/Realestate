/**
 * Pure decision for whether a just-authenticated user should be routed into
 * the /tour onboarding flow.
 *
 * Force onboarding ONLY for genuinely new accounts that have not finished
 * onboarding. Returning users (established accounts) always skip it.
 *
 * Signals:
 *  - onboardingCompletedAt: the real completion marker
 *    (user_profiles.onboarding_completed_at). If set, never onboard again.
 *  - accountCreatedAt: auth.users.created_at via session.user.created_at —
 *    the only reliable account-age signal (last_login_at / profile.created_at
 *    are not maintained). OAuth round-trips complete in seconds, so a 30-min
 *    window cleanly separates new signups from returning users.
 *  - type === "signup": the email-confirmation link carries this; the click
 *    can land hours after signup, so it onboards regardless of the age window.
 */
export const NEW_ACCOUNT_WINDOW_MS = 30 * 60_000;

export function decideNeedsOnboarding(input: {
  accountCreatedAt: string;
  type: string | null;
  onboardingCompletedAt: string | null;
  now: number;
  newAccountWindowMs?: number;
}): boolean {
  const {
    accountCreatedAt,
    type,
    onboardingCompletedAt,
    now,
    newAccountWindowMs = NEW_ACCOUNT_WINDOW_MS,
  } = input;

  if (onboardingCompletedAt) return false;

  const createdMs = new Date(accountCreatedAt).getTime();
  const isNewAccount =
    Number.isFinite(createdMs) && now - createdMs < newAccountWindowMs;
  const isEmailConfirmSignup = type === "signup";

  return isNewAccount || isEmailConfirmSignup;
}
