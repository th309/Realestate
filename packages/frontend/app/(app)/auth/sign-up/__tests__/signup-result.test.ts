/**
 * Pins the signup-result branching that was silently over-reporting a funnel stage.
 *
 * Measured 2026-07-29: on 2026-07-12 the pipeline recorded 5
 * `signup_pending_confirmation` events while `auth.users` gained exactly ONE
 * row that day; 2026-06-18 showed the same 5-vs-1 mismatch. The cause is a
 * fall-through in page.tsx: the already-registered guard reads
 * `user && (user.identities?.length ?? 0) === 0`, so when `signUp()` resolves
 * with `user: null` and NO error — which AuthContext can return verbatim,
 * `user: data?.user ?? null` — the guard is falsy and control drops into the
 * branch that announces "we sent you a code." No user existed and no code was
 * sent, but the funnel recorded a pending confirmation.
 *
 * That inflates the `signup_pending_confirmation` stage and manufactures a
 * fake drop between it and `signup_otp_verified` — the very gap this work set
 * out to explain. Making the outcomes exhaustive removes the fall-through by
 * construction: `no_user` is now a state you must handle, not the default.
 */

import { describe, it, expect } from "vitest";

import { classifySignupResult } from "../signup-result";

const AUTH_ERROR = { message: "User already registered" };
const SESSION = { access_token: "token" };

describe("classifySignupResult maps every Supabase signUp response to exactly one outcome", () => {
  it("reports an error outcome when Supabase returns an auth error", () => {
    expect(
      classifySignupResult({ error: AUTH_ERROR, session: null, user: null }),
    ).toBe("error");
  });

  it("prefers the error outcome even when a session is also present", () => {
    expect(
      classifySignupResult({ error: AUTH_ERROR, session: SESSION, user: {} }),
    ).toBe("error");
  });

  it("reports autoconfirmed when a session comes back immediately", () => {
    expect(
      classifySignupResult({
        error: null,
        session: SESSION,
        user: { identities: [{}] },
      }),
    ).toBe("autoconfirmed");
  });

  it("reports no_user when Supabase returns no error, no session and no user", () => {
    expect(
      classifySignupResult({ error: null, session: null, user: null }),
    ).toBe("no_user");
  });

  it("reports already_registered when the returned user has no identities", () => {
    expect(
      classifySignupResult({
        error: null,
        session: null,
        user: { identities: [] },
      }),
    ).toBe("already_registered");
  });

  it("treats a missing identities array as already_registered rather than a new signup", () => {
    expect(classifySignupResult({ error: null, session: null, user: {} })).toBe(
      "already_registered",
    );
  });

  it("reports awaiting_otp when the user has an identity and no session", () => {
    expect(
      classifySignupResult({
        error: null,
        session: null,
        user: { identities: [{ provider: "email" }] },
      }),
    ).toBe("awaiting_otp");
  });
});
