"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import { Mail, AlertCircle, Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth";
import { trackEvent, flush } from "@/lib/analytics/tracker";

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

function friendlyOtpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("expired")) {
    return "That code has expired. Request a new one below.";
  }
  if (m.includes("invalid") || m.includes("token") || m.includes("otp")) {
    return "That code didn't match. Check it and try again.";
  }
  return message;
}

export function OtpConfirmation({
  email,
  onVerified,
}: {
  email: string;
  onVerified: (session: Session) => void | Promise<void>;
}) {
  const { verifySignupOtp, resendSignupOtp } = useAuth();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const canVerify = code.length === 6 && !verifying && attempts < MAX_ATTEMPTS;

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!canVerify) return;
    setVerifying(true);
    setError(null);
    trackEvent("conversion.signup_otp_attempt", {});
    const { error: vErr, session } = await verifySignupOtp(email, code);
    if (vErr || !session) {
      const next = attempts + 1;
      setAttempts(next);
      setError(
        next >= MAX_ATTEMPTS
          ? "Too many attempts. Request a new code below."
          : friendlyOtpError(vErr?.message || "Verification failed"),
      );
      setVerifying(false);
      return;
    }
    trackEvent("conversion.signup_otp_verified", {});
    flush();
    await onVerified(session);
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    const { error: rErr } = await resendSignupOtp(email);
    setResending(false);
    if (rErr) {
      setError(
        rErr.message.toLowerCase().includes("rate")
          ? "Please wait a moment before requesting another code."
          : rErr.message,
      );
      return;
    }
    trackEvent("conversion.signup_otp_resent", {});
    setAttempts(0);
    setCode("");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    inputRef.current?.focus();
  };

  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Mail className="w-6 h-6 text-primary" />
      </div>
      <h2 className="text-lg font-medium text-on-surface mb-1">
        Enter your code
      </h2>
      <p className="text-sm text-on-surface-variant mb-6">
        We sent a code to{" "}
        <span className="font-medium text-on-surface">{email}</span>. Enter it
        below to activate your account.
      </p>

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

      <p className="mt-6 text-sm text-on-surface-variant">
        <Link
          href="/auth/sign-in"
          onClick={() => {
            // Abandoning the OTP step: clear the pending email so returning to
            // /auth/sign-up shows a fresh form, not a stale code screen.
            try {
              window.sessionStorage.removeItem("piq_signup_pending");
            } catch {
              /* ignore */
            }
          }}
          className="text-primary hover:text-primary/80 font-medium"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
