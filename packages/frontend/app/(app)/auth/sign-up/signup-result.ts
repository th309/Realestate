/**
 * Exhaustive classification of a Supabase `signUp()` response.
 *
 * Exists to kill a fall-through. page.tsx previously tested
 * `user && (user.identities?.length ?? 0) === 0` for the already-registered
 * case and then treated EVERYTHING ELSE as "code sent, awaiting OTP". A
 * response of `{ error: null, session: null, user: null }` — which AuthContext
 * can return verbatim, since it maps `user: data?.user ?? null` — is falsy at
 * that guard, so it silently became a pending confirmation.
 *
 * The cost was measurable: 5 `signup_pending_confirmation` events on
 * 2026-07-12 against exactly ONE new `auth.users` row that day, and the same
 * 5-vs-1 mismatch on 2026-06-18. Every one of those phantom stages then looked
 * like a user who received a code and failed to enter it, manufacturing the
 * drop-off this instrumentation was meant to explain.
 *
 * Returning a closed union rather than a boolean makes `no_user` a state the
 * caller must decide about. The bug is not "fixed" here so much as made
 * unrepresentable.
 */

export type SignupOutcome =
  /** Supabase reported a failure; the caller surfaces the message. */
  | "error"
  /** Autoconfirm is on (rare in prod): a session came back immediately. */
  | "autoconfirmed"
  /** No error, but no user either. NOT a signup — never announce a sent code. */
  | "no_user"
  /** Confirmed account re-signing up: Supabase obfuscates it as a user with no identities. */
  | "already_registered"
  /** Brand-new or existing-unconfirmed: a 6-digit code really was sent. */
  | "awaiting_otp";

/**
 * Compile-time proof that every `SignupOutcome` has been handled.
 *
 * Callers must branch with a `switch` whose every case returns, then call this
 * afterwards. If `SignupOutcome` gains a member that the switch does not
 * cover, `value` is no longer `never` and the call fails to compile — which is
 * the whole point. Without it, an unhandled outcome falls past the branches and
 * lands on whatever code follows, which in the sign-up page is the "we sent you
 * a code" path: the exact silent-default bug this module exists to remove.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled signup outcome: ${String(value)}`);
}

export function classifySignupResult(result: {
  error: unknown | null;
  session: unknown | null;
  user: { identities?: unknown[] | null } | null;
}): SignupOutcome {
  if (result.error) return "error";
  if (result.session) return "autoconfirmed";
  // Must precede the identities check: a null user has no identities either,
  // and conflating the two is exactly the bug this module removes.
  if (!result.user) return "no_user";
  if ((result.user.identities?.length ?? 0) === 0) return "already_registered";
  return "awaiting_otp";
}
