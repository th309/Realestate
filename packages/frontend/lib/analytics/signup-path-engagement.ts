/**
 * Marks that a visitor engaged the EMAIL signup path, exactly once per form mount.
 *
 * Why this exists: over the 30 days to 2026-07-29, 75 `signup_start` events
 * produced 12 `signup_pending_confirmation` — 63 sessions reached the form and
 * emitted nothing further. `signup_start` fires on mount, before any path is
 * chosen, so it cannot carry a method; and the Google path already announces
 * itself via `signup_oauth_click`. The email path had no equivalent, so
 * "typed an email and gave up" was indistinguishable from "never touched the
 * form." Those need different fixes, so they need different events.
 *
 * Latched deliberately: this fires from onChange handlers, so without the latch
 * a single abandoned signup emits one event per keystroke — inflating the funnel
 * stage it was added to measure.
 *
 * Not flushed: unlike the OAuth events, no full-page redirect follows, so the
 * normal batch cadence is enough and costs one fewer request.
 */

import { trackEvent } from "./tracker";

export type SignupCredentialField =
  | "email"
  | "password"
  | "confirm_password"
  | "tos";

/**
 * Build a one-shot engagement marker. One tracker per form mount; call it from
 * every credential-field handler and it reports only the field touched first.
 */
export function createSignupPathEngagementTracker(): (
  field: SignupCredentialField,
) => void {
  let engaged = false;

  return function markEngaged(field: SignupCredentialField): void {
    if (engaged) return;
    engaged = true;
    trackEvent("conversion.signup_email_engaged", { field });
  };
}
