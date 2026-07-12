// packages/frontend/app/(app)/auth/sign-in/__tests__/page.test.tsx
//
// Covers the magic-link "enter code instead" OTP path added for task 5.1.
// Password sign-in / OAuth flows are unchanged and not re-tested here.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import SignInPage from "../page";

vi.mock("@/lib/analytics/tracker", () => ({
  trackEvent: vi.fn(),
  flush: vi.fn(),
}));

const searchParamsGet = vi.fn(() => null);
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: searchParamsGet }),
}));

const signInWithPassword = vi.fn();
const signInWithMagicLink = vi.fn();
const signInWithOAuth = vi.fn();
const verifyMagicLinkOtp = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signInWithPassword,
    signInWithMagicLink,
    signInWithOAuth,
    verifyMagicLinkOtp,
  }),
}));

let standalone = false;
vi.mock("@/lib/pwa/is-standalone", () => ({
  isStandaloneDisplayMode: () => standalone,
}));

const mockSession = { user: { id: "u1" } } as unknown as Session;

async function sendMagicLink(email = "user@test.com") {
  fireEvent.click(
    screen.getByRole("button", { name: /sign in with magic link/i }),
  );
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: /send magic link/i }));
  await waitFor(() => {
    expect(signInWithMagicLink).toHaveBeenCalledWith(email);
  });
}

describe("SignInPage magic-link OTP", () => {
  beforeEach(() => {
    standalone = false;
    searchParamsGet.mockReturnValue(null);
    signInWithPassword.mockReset();
    signInWithMagicLink.mockReset().mockResolvedValue({ error: null });
    signInWithOAuth.mockReset();
    verifyMagicLinkOtp.mockReset();
  });

  it("browser mode: shows 'Check your email' with a secondary 'Enter code instead' toggle", async () => {
    render(<SignInPage />);
    await sendMagicLink();
    expect(
      screen.getByRole("heading", { name: /check your email/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/verification code/i),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /enter code instead/i }),
    );
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
  });

  it("standalone mode: leads with the code form expanded automatically", async () => {
    standalone = true;
    render(<SignInPage />);
    await sendMagicLink();
    expect(
      screen.getByRole("heading", { name: /enter your code/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
  });

  it("verifies via verifyMagicLinkOtp(email, code) and redirects to /map on success", async () => {
    verifyMagicLinkOtp.mockResolvedValue({ error: null, session: mockSession });
    const originalLocation = window.location;
    // @ts-expect-error - jsdom navigation stub, matches Step4Aha.test.tsx pattern
    delete window.location;
    // @ts-expect-error - jsdom navigation stub
    window.location = { href: "" };

    render(<SignInPage />);
    await sendMagicLink();
    fireEvent.click(
      screen.getByRole("button", { name: /enter code instead/i }),
    );
    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: "246810" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() => {
      expect(verifyMagicLinkOtp).toHaveBeenCalledWith(
        "user@test.com",
        "246810",
      );
      expect(window.location.href).toBe("/map");
    });

    // @ts-expect-error - restoring jsdom navigation stub
    window.location = originalLocation;
  });

  it("resending the code reinvokes signInWithMagicLink(email)", async () => {
    render(<SignInPage />);
    await sendMagicLink();
    fireEvent.click(
      screen.getByRole("button", { name: /enter code instead/i }),
    );
    signInWithMagicLink.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /^resend code$/i }));
    await waitFor(() => {
      expect(signInWithMagicLink).toHaveBeenCalledWith("user@test.com");
    });
  });

  it("'Back to sign in' returns to the password form", async () => {
    render(<SignInPage />);
    await sendMagicLink();
    fireEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
    expect(
      screen.getByRole("button", { name: /^sign in$/i }),
    ).toBeInTheDocument();
  });
});
