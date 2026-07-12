// packages/frontend/app/(app)/auth/forgot-password/__tests__/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import ForgotPasswordPage from "../page";

vi.mock("@/lib/analytics/tracker", () => ({
  trackEvent: vi.fn(),
  flush: vi.fn(),
}));

const resetPassword = vi.fn();
const verifyRecoveryOtp = vi.fn();
const updatePassword = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ resetPassword, verifyRecoveryOtp, updatePassword }),
}));

let standalone = false;
vi.mock("@/lib/pwa/is-standalone", () => ({
  isStandaloneDisplayMode: () => standalone,
}));

const mockSession = { user: { id: "u1" } } as unknown as Session;

async function sendResetEmail(email = "user@test.com") {
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
  await waitFor(() => {
    expect(screen.getByText(email)).toBeInTheDocument();
  });
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    standalone = false;
    resetPassword.mockReset().mockResolvedValue({ error: null });
    verifyRecoveryOtp.mockReset();
    updatePassword.mockReset();
  });

  it("submits the email to resetPassword and shows the sent state", async () => {
    render(<ForgotPasswordPage />);
    await sendResetEmail();
    expect(resetPassword).toHaveBeenCalledWith("user@test.com");
    expect(
      screen.getByRole("heading", { name: /check your email/i }),
    ).toBeInTheDocument();
  });

  it("browser mode: leads with the link, offers 'Enter code instead' secondary", async () => {
    render(<ForgotPasswordPage />);
    await sendResetEmail();
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
    render(<ForgotPasswordPage />);
    await sendResetEmail();
    expect(
      screen.getByRole("heading", { name: /enter your code/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
  });

  it("verifying the code via verifyRecoveryOtp shows the new-password form", async () => {
    verifyRecoveryOtp.mockResolvedValue({ error: null, session: mockSession });
    render(<ForgotPasswordPage />);
    await sendResetEmail();
    fireEvent.click(
      screen.getByRole("button", { name: /enter code instead/i }),
    );
    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() => {
      expect(verifyRecoveryOtp).toHaveBeenCalledWith("user@test.com", "123456");
      expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    });
  });

  it("submitting matching passwords calls updatePassword and redirects to /account?reset=true", async () => {
    verifyRecoveryOtp.mockResolvedValue({ error: null, session: mockSession });
    updatePassword.mockResolvedValue({ error: null });

    const originalLocation = window.location;
    // @ts-expect-error - jsdom navigation stub, matches Step4Aha.test.tsx pattern
    delete window.location;
    // @ts-expect-error - jsdom navigation stub
    window.location = { href: "" };

    render(<ForgotPasswordPage />);
    await sendResetEmail();
    fireEvent.click(
      screen.getByRole("button", { name: /enter code instead/i }),
    );
    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "NewStrongPass1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: "NewStrongPass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() => {
      expect(updatePassword).toHaveBeenCalledWith("NewStrongPass1");
      expect(window.location.href).toBe("/account?reset=true");
    });

    // @ts-expect-error - restoring jsdom navigation stub
    window.location = originalLocation;
  });

  it("shows an error and does not call updatePassword when passwords do not match", async () => {
    verifyRecoveryOtp.mockResolvedValue({ error: null, session: mockSession });
    render(<ForgotPasswordPage />);
    await sendResetEmail();
    fireEvent.click(
      screen.getByRole("button", { name: /enter code instead/i }),
    );
    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "NewStrongPass1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: "Different1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(updatePassword).not.toHaveBeenCalled();
  });
});
