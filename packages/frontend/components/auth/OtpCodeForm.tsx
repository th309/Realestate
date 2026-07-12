"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import type { AuthError, Session } from "@supabase/supabase-js";
import { trackEvent, flush } from "@/lib/analytics/tracker";

export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Supabase returns ONE ambiguous message ("Token has expired or is invalid")
 * for both wrong and expired codes — by design, to avoid leaking which — so
 * we can't distinguish them. Show a single clear message.
 */
export function friendlyOtpError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("expired") ||
    m.includes("invalid") ||
    m.includes("token") ||
    m.includes("otp")
  ) {
    return "That code is incorrect or has expired. Double-check it, or request a new one below.";
  }
  return message;
}

export interface OtpCodeFormProps {
  /** Email the code was sent to — passed through to `verify`/shown nowhere here. */
  email: string;
  /** Verifies the 6-digit code against Supabase; resolves a session on success. */
  verify: (
    email: string,
    token: string,
  ) => Promise<{ error: AuthError | null; session: Session | null }>;
  /** Called once verification succeeds. */
  onVerified: (session: Session) => void | Promise<void>;
  /** Re-sends the code. The underlying call differs per flow (signup/recovery/magic-link). */
  resend: () => Promise<{ error: AuthError | null }>;
  /** Prefix for the `conversion.*_attempt/_verified/_resent` analytics events this form fires. */
  eventPrefix: string;
  /** Focus the code input on mount. Default true. */
  autoFocus?: boolean;
}

export function OtpCodeForm({
  email,
  verify,
  onVerified,
  resend,
  eventPrefix,
  autoFocus = true,
}: OtpCodeFormProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const canVerify =
    code.length === 6 && !verifying && attempts < OTP_MAX_ATTEMPTS;

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!canVerify) return;
    setVerifying(true);
    setError(null);
    trackEvent(`${eventPrefix}_attempt`, {});
    const { error: vErr, session } = await verify(email, code);
    if (vErr || !session) {
      const next = attempts + 1;
      setAttempts(next);
      setError(
        next >= OTP_MAX_ATTEMPTS
          ? "Too many attempts. Request a new code below."
          : friendlyOtpError(vErr?.message || "Verification failed"),
      );
      setVerifying(false);
      return;
    }
    trackEvent(`${eventPrefix}_verified`, {});
    flush();
    await onVerified(session);
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    const { error: rErr } = await resend();
    setResending(false);
    if (rErr) {
      setError(
        rErr.message.toLowerCase().includes("rate")
          ? "Please wait a moment before requesting another code."
          : rErr.message,
      );
      return;
    }
    trackEvent(`${eventPrefix}_resent`, {});
    setAttempts(0);
    setCode("");
    setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
    inputRef.current?.focus();
  };

  return (
    <>
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error text-left">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        {/* maxLength/slice MUST match Supabase mailer_otp_length (6). If that
            config changes, update here AND the getSignupOtp E2E length guard. */}
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          aria-label="Verification code"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          disabled={verifying}
          className="w-full text-center font-mono text-lg tracking-[0.5em] py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canVerify}
          className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
          Verify
        </button>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || resending}
        className="mt-5 text-sm text-primary hover:text-primary/80 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {cooldown > 0
          ? `Resend code in ${cooldown}s`
          : resending
            ? "Sending..."
            : "Resend code"}
      </button>
    </>
  );
}
