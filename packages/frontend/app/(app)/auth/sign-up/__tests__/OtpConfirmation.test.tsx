// packages/frontend/app/(app)/auth/sign-up/__tests__/OtpConfirmation.test.tsx
//
// Regression coverage for the OtpCodeForm extraction (task 5.1): proves the
// signup OTP screen is behavior-identical — same heading, same
// autocomplete="one-time-code" input, same "Verify" button, same friendly
// error copy, same verify/resend wiring — since these are exactly what
// tests/e2e/signup-chain.spec.ts drives against the live app.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { OtpConfirmation } from "../OtpConfirmation";

vi.mock("@/lib/analytics/tracker", () => ({
  trackEvent: vi.fn(),
  flush: vi.fn(),
}));

const verifySignupOtp = vi.fn();
const resendSignupOtp = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ verifySignupOtp, resendSignupOtp }),
}));

const mockSession = { user: { id: "u1" } } as unknown as Session;

describe("OtpConfirmation", () => {
  beforeEach(() => {
    verifySignupOtp.mockReset();
    resendSignupOtp.mockReset();
  });

  it("renders the 'Enter your code' heading and the email", () => {
    render(<OtpConfirmation email="new@user.com" onVerified={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /enter your code/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("new@user.com")).toBeInTheDocument();
  });

  it("renders the one-time-code input and Verify button", () => {
    render(<OtpConfirmation email="new@user.com" onVerified={vi.fn()} />);
    expect(
      screen.getByLabelText(/verification code/i).getAttribute("autocomplete"),
    ).toBe("one-time-code");
    expect(
      screen.getByRole("button", { name: /^verify$/i }),
    ).toBeInTheDocument();
  });

  it("verifies via verifySignupOtp(email, code) and calls onVerified on success", async () => {
    verifySignupOtp.mockResolvedValue({ error: null, session: mockSession });
    const onVerified = vi.fn();
    render(<OtpConfirmation email="new@user.com" onVerified={onVerified} />);
    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() => {
      expect(verifySignupOtp).toHaveBeenCalledWith("new@user.com", "654321");
      expect(onVerified).toHaveBeenCalledWith(mockSession);
    });
  });

  it("shows the friendly 'incorrect or has expired' error on a wrong code", async () => {
    verifySignupOtp.mockResolvedValue({
      error: { message: "Token has expired or is invalid" },
      session: null,
    });
    render(<OtpConfirmation email="new@user.com" onVerified={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() => {
      expect(screen.getByText(/incorrect or has expired/i)).toBeInTheDocument();
    });
  });

  it("resends via resendSignupOtp(email)", async () => {
    resendSignupOtp.mockResolvedValue({ error: null });
    render(<OtpConfirmation email="new@user.com" onVerified={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /resend code/i }));
    await waitFor(() => {
      expect(resendSignupOtp).toHaveBeenCalledWith("new@user.com");
    });
  });

  it("clears piq_signup_pending when 'Back to sign in' is clicked", () => {
    window.sessionStorage.setItem(
      "piq_signup_pending",
      JSON.stringify({ email: "new@user.com" }),
    );
    render(<OtpConfirmation email="new@user.com" onVerified={vi.fn()} />);
    fireEvent.click(screen.getByRole("link", { name: /back to sign in/i }));
    expect(window.sessionStorage.getItem("piq_signup_pending")).toBeNull();
  });
});
