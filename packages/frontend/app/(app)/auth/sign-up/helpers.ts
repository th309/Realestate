export interface PasswordRequirement {
  label: string;
  met: boolean;
}

export function getPasswordRequirements(
  password: string,
): PasswordRequirement[] {
  return [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "At least 1 uppercase letter", met: /[A-Z]/.test(password) },
    { label: "At least 1 lowercase letter", met: /[a-z]/.test(password) },
    { label: "At least 1 number", met: /[0-9]/.test(password) },
  ];
}

export function allRequirementsMet(password: string): boolean {
  return getPasswordRequirements(password).every((r) => r.met);
}

/** Read the content-pipeline attribution cookie set by /go/[slug]. */
export function readAttributionCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)__piq_attr=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Reduce a raw auth error to one of a fixed set of categories, for analytics.
 *
 * Raw provider messages are freeform text controlled upstream (Supabase, the
 * custom Send-Email hook, Google) and may interpolate account details, so they
 * must never be shipped to the analytics pipeline and persisted in the shared
 * user_events store. This is a strict allow-list: anything unrecognised
 * collapses to "other" rather than falling through to the original string.
 */
export function classifyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already exists"))
    return "already_registered";
  if (lower.includes("provider") && lower.includes("not enabled"))
    return "provider_not_enabled";
  if (lower.includes("provider") && lower.includes("disabled"))
    return "provider_disabled";
  if (lower.includes("popup") || lower.includes("cancelled"))
    return "user_cancelled";
  if (lower.includes("rate") || lower.includes("too many"))
    return "rate_limited";
  if (lower.includes("password")) return "password_rejected";
  if (lower.includes("email")) return "email_rejected";
  if (lower.includes("network") || lower.includes("fetch"))
    return "network_error";
  return "other";
}

/** Map raw Supabase/OAuth error messages to user-friendly text. */
export function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("provider") && lower.includes("not enabled")) {
    return "Google sign-up is not currently available. Please use email and password instead.";
  }
  if (lower.includes("provider") && lower.includes("disabled")) {
    return "Google sign-up is not currently available. Please use email and password instead.";
  }
  if (lower.includes("popup") || lower.includes("cancelled")) {
    return "Sign-up was cancelled. Please try again.";
  }
  return message;
}
