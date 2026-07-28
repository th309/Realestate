/**
 * Pins the behaviour that was actually broken in production: `signup_complete`
 * with method='oauth' never fired once between 2026-06-12 (when the event
 * shipped) and 2026-07-28, because the old callback gated it behind a 60-second
 * wall-clock window that a real Google flow — measured at 155s — could not
 * meet.
 *
 * The "returning user" cases below are the important ones. /auth/callback calls
 * this on EVERY OAuth sign-in, not just the first, so any unconditional
 * fail-open duplicate-fires the conversion for existing users whenever the
 * database is flaky.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../tracker", () => ({
  trackEvent: vi.fn(),
  flush: vi.fn(),
  setUserId: vi.fn(),
  gtagEvent: vi.fn(),
}));

import { emitSignupCompleteOnce } from "../signup-conversion";
import { trackEvent, setUserId } from "../tracker";

const USER_ID = "206a9531-68d5-463a-9805-29ec2ca77994";
const JUST_NOW = () => new Date(Date.now() - 60_000).toISOString();
const LONG_AGO = "2026-04-13T20:53:44.942841Z";

type ClaimResult = {
  data: { id: string }[] | null;
  error: { message: string } | null;
};

/**
 * Minimal stand-in for the supabase-js query builder: `.update().eq().is()
 * .select()` for the claim, `.select().eq().maybeSingle()` for the prior-state
 * read, and `.upsert()` for the missing-profile repair.
 */
function makeClient(opts: {
  claim: ClaimResult;
  row?: { signup_completed_at: string | null } | null;
  readError?: { message: string } | null;
}) {
  const upserts: Record<string, unknown>[] = [];

  const client = {
    from: () => ({
      update: () => {
        const chain: Record<string, unknown> = {};
        chain.eq = () => chain;
        chain.is = () => chain;
        chain.select = async () => opts.claim;
        return chain;
      },
      select: () => {
        const chain: Record<string, unknown> = {};
        chain.eq = () => chain;
        chain.maybeSingle = async () => ({
          data: opts.row ?? null,
          error: opts.readError ?? null,
        });
        return chain;
      },
      upsert: async (values: Record<string, unknown>) => {
        upserts.push(values);
        return { error: null };
      },
    }),
  };

  return { client: client as never, upserts };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("emitSignupCompleteOnce emits when the claim is won", () => {
  it("emits method='oauth' when the row was unclaimed", async () => {
    const { client } = makeClient({
      claim: { data: [{ id: USER_ID }], error: null },
    });

    expect(
      await emitSignupCompleteOnce(client, USER_ID, "oauth", JUST_NOW()),
    ).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith("conversion.signup_complete", {
      method: "oauth",
    });
  });

  it("attributes the event to the user BEFORE emitting, so user_id is never null", async () => {
    const { client } = makeClient({
      claim: { data: [{ id: USER_ID }], error: null },
    });

    await emitSignupCompleteOnce(client, USER_ID, "oauth", JUST_NOW());

    expect(setUserId).toHaveBeenCalledWith(USER_ID);
    expect(vi.mocked(setUserId).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(trackEvent).mock.invocationCallOrder[0],
    );
  });
});

describe("emitSignupCompleteOnce stays silent once the conversion is recorded", () => {
  it("does not emit when the row is already claimed", async () => {
    const { client } = makeClient({
      claim: { data: [], error: null },
      row: { signup_completed_at: "2026-06-18T16:28:23.000Z" },
    });

    expect(
      await emitSignupCompleteOnce(client, USER_ID, "oauth", LONG_AGO),
    ).toBe(false);
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe("emitSignupCompleteOnce never duplicate-fires for returning users", () => {
  // Regression guard: /auth/callback runs this on every OAuth sign-in, so a
  // DB blip must not re-fire the conversion (and its GA4 mirrors) for an
  // established account.
  it("stays silent when the claim errors for an account created long ago", async () => {
    const { client } = makeClient({
      claim: { data: null, error: { message: "network" } },
      readError: { message: "network" },
    });

    expect(
      await emitSignupCompleteOnce(client, USER_ID, "oauth", LONG_AGO),
    ).toBe(false);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("stays silent when the account age is unknown", async () => {
    const { client } = makeClient({
      claim: { data: null, error: { message: "network" } },
      readError: { message: "network" },
    });

    expect(await emitSignupCompleteOnce(client, USER_ID, "oauth", null)).toBe(
      false,
    );
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe("emitSignupCompleteOnce fails open only for genuinely new accounts", () => {
  it("emits with claim_fallback='claim_error' when the claim errors for a fresh account", async () => {
    const { client } = makeClient({
      claim: { data: null, error: { message: "network" } },
      readError: { message: "network" },
    });

    expect(
      await emitSignupCompleteOnce(client, USER_ID, "oauth", JUST_NOW()),
    ).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith("conversion.signup_complete", {
      method: "oauth",
      claim_fallback: "claim_error",
    });
  });

  // Regression guard: without persisting the marker here, the caller's own
  // upsert creates a row with signup_completed_at NULL and the NEXT sign-in
  // claims it and fires a second conversion.
  it("persists the marker before emitting when no profile row exists", async () => {
    const { client, upserts } = makeClient({
      claim: { data: [], error: null },
      row: null,
    });

    expect(
      await emitSignupCompleteOnce(client, USER_ID, "email", JUST_NOW()),
    ).toBe(true);
    expect(upserts[0]).toMatchObject({ id: USER_ID });
    expect(upserts[0]).toHaveProperty("signup_completed_at");
    expect(trackEvent).toHaveBeenCalledWith("conversion.signup_complete", {
      method: "email",
      claim_fallback: "no_profile_row",
    });
  });

  it("does not create a row or emit when no profile exists on an old account", async () => {
    const { client, upserts } = makeClient({
      claim: { data: [], error: null },
      row: null,
    });

    expect(
      await emitSignupCompleteOnce(client, USER_ID, "email", LONG_AGO),
    ).toBe(false);
    expect(upserts).toHaveLength(0);
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
