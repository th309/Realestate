/**
 * Pins the instrumentation that makes the signup drop-off attributable.
 *
 * Measured 2026-07-29 over 30 days: 75 `signup_start` produced only 12
 * `signup_pending_confirmation` — 63 sessions reached the form and emitted
 * nothing further on either path. Those 63 are currently indistinguishable
 * between three very different stories:
 *
 *   1. typed into the email form and gave up,
 *   2. clicked Google and the flow broke,
 *   3. looked at the form and left without touching it.
 *
 * (2) is already covered by `signup_oauth_click`. (1) had no event at all —
 * nothing fires between the form rendering and a successful submit — so (1) and
 * (3) collapse together. This tracker separates them.
 *
 * Latching matters: without it every keystroke emits, turning one abandoned
 * signup into dozens of events and destroying the funnel counts it exists to fix.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../tracker", () => ({
  trackEvent: vi.fn(),
  flush: vi.fn(),
  setUserId: vi.fn(),
  gtagEvent: vi.fn(),
}));

import { createSignupPathEngagementTracker } from "../signup-path-engagement";
import { trackEvent } from "../tracker";

describe("createSignupPathEngagementTracker emits one email-path engagement per form mount", () => {
  beforeEach(() => {
    vi.mocked(trackEvent).mockClear();
  });

  it("emits signup_email_engaged the first time a credential field is touched", () => {
    const markEngaged = createSignupPathEngagementTracker();

    markEngaged("email");

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("conversion.signup_email_engaged", {
      field: "email",
    });
  });

  it("does not emit again when further fields are touched in the same mount", () => {
    const markEngaged = createSignupPathEngagementTracker();

    markEngaged("email");
    markEngaged("password");
    markEngaged("confirm_password");
    markEngaged("tos");

    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it("reports the field that first triggered engagement, not a later one", () => {
    const markEngaged = createSignupPathEngagementTracker();

    markEngaged("tos");
    markEngaged("email");

    expect(trackEvent).toHaveBeenCalledWith("conversion.signup_email_engaged", {
      field: "tos",
    });
  });

  it("latches per tracker instance so a remounted form can engage again", () => {
    const firstMount = createSignupPathEngagementTracker();
    const secondMount = createSignupPathEngagementTracker();

    firstMount("email");
    secondMount("password");

    expect(trackEvent).toHaveBeenCalledTimes(2);
    expect(trackEvent).toHaveBeenNthCalledWith(
      2,
      "conversion.signup_email_engaged",
      { field: "password" },
    );
  });
});
