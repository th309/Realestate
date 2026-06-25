import { describe, it, expect } from "vitest";
import { decideNeedsOnboarding } from "../onboarding-routing";

const NOW = 1_750_000_000_000;
const isoAgo = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

describe("decideNeedsOnboarding", () => {
  it("new OAuth account, not completed -> true", () => {
    expect(
      decideNeedsOnboarding({
        accountCreatedAt: isoAgo(5_000),
        type: null,
        onboardingCompletedAt: null,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("old account, not completed -> false (the reported bug)", () => {
    expect(
      decideNeedsOnboarding({
        accountCreatedAt: isoAgo(60 * DAY),
        type: null,
        onboardingCompletedAt: null,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("delayed email-confirm signup (old-ish account), not completed -> true", () => {
    expect(
      decideNeedsOnboarding({
        accountCreatedAt: isoAgo(6 * 60 * MIN),
        type: "signup",
        onboardingCompletedAt: null,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("completed onboarding -> false regardless of age/type", () => {
    expect(
      decideNeedsOnboarding({
        accountCreatedAt: isoAgo(5_000),
        type: "signup",
        onboardingCompletedAt: isoAgo(1_000),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("invalid created_at and not email-confirm -> false", () => {
    expect(
      decideNeedsOnboarding({
        accountCreatedAt: "not-a-date",
        type: null,
        onboardingCompletedAt: null,
        now: NOW,
      }),
    ).toBe(false);
  });
});
