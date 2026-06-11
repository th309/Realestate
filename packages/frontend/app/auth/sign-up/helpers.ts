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
