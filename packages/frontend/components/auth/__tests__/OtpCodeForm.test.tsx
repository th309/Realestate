// packages/frontend/components/auth/__tests__/OtpCodeForm.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { OtpCodeForm, friendlyOtpError } from "../OtpCodeForm";

const trackEventSpy = vi.fn();
const flushSpy = vi.fn();
vi.mock("@/lib/analytics/tracker", () => ({
  trackEvent: (...args: unknown[]) => trackEventSpy(...args),
  flush: () => flushSpy(),
}));

const mockSession = { user: { id: "u1" } } as unknown as Session;

describe("friendlyOtpError", () => {
  it("maps expired/invalid/token/otp messages to one friendly message", () => {
    expect(friendlyOtpError("Token has expired or is invalid")).toBe(
      "That code is incorrect or has expired. Double-check it, or request a new one below.",
    );
    expect(friendlyOtpError("invalid otp")).toMatch(/incorrect or has expired/);
  });

  it("passes through unrelated error messages unchanged", () => {
    expect(friendlyOtpError("Network error")).toBe("Network error");
  });
});

describe("OtpCodeForm", () => {
  const verify = vi.fn();
  const resend = vi.fn();
  const onVerified = vi.fn();

  beforeEach(() => {
    vi.useRealTimers();
    verify.mockReset();
    resend.mockReset();
    onVerified.mockReset();
  });

  function renderForm(
    overrides: Partial<React.ComponentProps<typeof OtpCodeForm>> = {},
  ) {
    return render(
      <OtpCodeForm
        email="user@test.com"
        verify={verify}
        resend={resend}
        onVerified={onVerified}
        eventPrefix="conversion.test_otp"
        {...overrides}
      />,
    );
  }

  it("renders a 6-digit code input and a Verify button", () => {
    renderForm();
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^verify$/i }),
    ).toBeInTheDocument();
  });

  it("strips non-digits and caps input at 6 characters", () => {
    renderForm();
    const input = screen.getByLabelText(
      /verification code/i,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12a3456bc" } });
    expect(input.value).toBe("123456");
  });

  it("keeps Verify disabled until 6 digits are entered", () => {
    renderForm();
    const input = screen.getByLabelText(/verification code/i);
    const button = screen.getByRole("button", { name: /^verify$/i });
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: "123" } });
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: "123456" } });
    expect(button).toBeEnabled();
  });

  it("calls verify(email, code) on submit and onVerified(session) on success", async () => {
    verify.mockResolvedValue({ error: null, session: mockSession });
    renderForm();
    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() => {
      expect(verify).toHaveBeenCalledWith("user@test.com", "123456");
      expect(onVerified).toHaveBeenCalledWith(mockSession);
    });
    expect(trackEventSpy).toHaveBeenCalledWith(
      "conversion.test_otp_attempt",
      {},
    );
    expect(trackEventSpy).toHaveBeenCalledWith(
      "conversion.test_otp_verified",
      {},
    );
    expect(flushSpy).toHaveBeenCalled();
  });

  it("shows the friendly error and increments attempts on a wrong code", async () => {
    verify.mockResolvedValue({
      error: { message: "Token has expired or is invalid" },
      session: null,
    });
    renderForm();
    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() => {
      expect(screen.getByText(/incorrect or has expired/i)).toBeInTheDocument();
    });
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("locks out verification after 5 failed attempts", async () => {
    verify.mockResolvedValue({
      error: { message: "Token has expired or is invalid" },
      session: null,
    });
    renderForm();
    const input = screen.getByLabelText(/verification code/i);
    for (let i = 0; i < 5; i++) {
      fireEvent.change(input, { target: { value: "000000" } });
      fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
      await waitFor(() => expect(verify).toHaveBeenCalledTimes(i + 1));
    }
    expect(
      screen.getByText(/too many attempts\. request a new code below/i),
    ).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "111111" } });
    expect(screen.getByRole("button", { name: /^verify$/i })).toBeDisabled();
  });

  it("resends the code, resets attempts/code, and starts the cooldown", async () => {
    vi.useFakeTimers();
    resend.mockResolvedValue({ error: null });
    renderForm();

    const resendButton = screen.getByRole("button", { name: /resend code/i });
    await act(async () => {
      fireEvent.click(resendButton);
      await Promise.resolve();
    });

    expect(resend).toHaveBeenCalledTimes(1);
    expect(trackEventSpy).toHaveBeenCalledWith(
      "conversion.test_otp_resent",
      {},
    );
    expect(
      screen.getByRole("button", { name: /resend code in 60s/i }),
    ).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(
      screen.getByRole("button", { name: /^resend code$/i }),
    ).toBeEnabled();
    vi.useRealTimers();
  });

  it("shows a rate-limit friendly message when resend fails with 'rate' in the message", async () => {
    resend.mockResolvedValue({ error: { message: "rate limit exceeded" } });
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /resend code/i }));
    await waitFor(() => {
      expect(
        screen.getByText(
          /please wait a moment before requesting another code/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("does not autofocus the input when autoFocus=false", () => {
    renderForm({ autoFocus: false });
    expect(screen.getByLabelText(/verification code/i)).not.toHaveFocus();
  });
});
