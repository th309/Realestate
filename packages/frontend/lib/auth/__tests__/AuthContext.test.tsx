// packages/frontend/lib/auth/__tests__/AuthContext.test.tsx
//
// Covers the two OTP-code auth methods added for task 5.1 (standalone-safe
// password reset + magic-link sign-in): verifyRecoveryOtp and
// verifyMagicLinkOtp. Mocks the Supabase browser client the same way
// components/entitlements/__tests__/AnonCaptureModal.test.tsx does, and
// useAuthState (session hydration) so the provider mounts instantly.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "../AuthContext";

const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { verifyOtp } }),
}));

vi.mock("../useAuth", () => ({
  useAuthState: () => ({ user: null, session: null, loading: false }),
}));

function Probe({
  onReady,
}: {
  onReady: (auth: ReturnType<typeof useAuth>) => void;
}) {
  const auth = useAuth();
  onReady(auth);
  return null;
}

function renderAuth() {
  let captured: ReturnType<typeof useAuth> | null = null;
  render(
    <AuthProvider>
      <Probe onReady={(auth) => (captured = auth)} />
    </AuthProvider>,
  );
  return () => captured as ReturnType<typeof useAuth>;
}

describe("AuthContext OTP methods", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
  });

  it("verifyRecoveryOtp calls supabase.auth.verifyOtp with type=recovery and returns the session", async () => {
    const session = { user: { id: "u1" } } as unknown as Session;
    verifyOtp.mockResolvedValue({ data: { session }, error: null });
    const getAuth = renderAuth();

    const result = await getAuth().verifyRecoveryOtp("user@test.com", "123456");

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "user@test.com",
      token: "123456",
      type: "recovery",
    });
    expect(result).toEqual({ error: null, session });
  });

  it("verifyRecoveryOtp surfaces the error and a null session on failure", async () => {
    const authError = { message: "Token has expired or is invalid" };
    verifyOtp.mockResolvedValue({ data: { session: null }, error: authError });
    const getAuth = renderAuth();

    const result = await getAuth().verifyRecoveryOtp("user@test.com", "000000");

    expect(result).toEqual({ error: authError, session: null });
  });

  it("verifyMagicLinkOtp calls supabase.auth.verifyOtp with type=email (same call signup makes) and returns the session", async () => {
    const session = { user: { id: "u2" } } as unknown as Session;
    verifyOtp.mockResolvedValue({ data: { session }, error: null });
    const getAuth = renderAuth();

    const result = await getAuth().verifyMagicLinkOtp(
      "user@test.com",
      "654321",
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "user@test.com",
      token: "654321",
      type: "email",
    });
    expect(result).toEqual({ error: null, session });
  });

  it("verifyMagicLinkOtp surfaces the error and a null session on failure", async () => {
    const authError = { message: "Token has expired or is invalid" };
    verifyOtp.mockResolvedValue({ data: { session: null }, error: authError });
    const getAuth = renderAuth();

    const result = await getAuth().verifyMagicLinkOtp(
      "user@test.com",
      "000000",
    );

    expect(result).toEqual({ error: authError, session: null });
  });

  it("exposes verifyRecoveryOtp and verifyMagicLinkOtp as distinct functions from verifySignupOtp", () => {
    const getAuth = renderAuth();
    const auth = getAuth();
    expect(typeof auth.verifyRecoveryOtp).toBe("function");
    expect(typeof auth.verifyMagicLinkOtp).toBe("function");
    expect(auth.verifyRecoveryOtp).not.toBe(auth.verifySignupOtp);
    expect(auth.verifyMagicLinkOtp).not.toBe(auth.verifySignupOtp);
  });
});
