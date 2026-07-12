"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth";
import { OtpCodeForm } from "@/components/auth/OtpCodeForm";

export function OtpConfirmation({
  email,
  onVerified,
}: {
  email: string;
  onVerified: (session: Session) => void | Promise<void>;
}) {
  const { verifySignupOtp, resendSignupOtp } = useAuth();

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

      <OtpCodeForm
        email={email}
        verify={verifySignupOtp}
        onVerified={onVerified}
        resend={() => resendSignupOtp(email)}
        eventPrefix="conversion.signup_otp"
      />

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
