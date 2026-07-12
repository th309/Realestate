"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import type { AuthError, Session } from "@supabase/supabase-js";
import { OtpCodeForm } from "@/components/auth/OtpCodeForm";
import { isStandaloneDisplayMode } from "@/lib/pwa/is-standalone";

/**
 * Shown after signInWithMagicLink() succeeds. In an installed PWA the email
 * link opens the phone's browser (not the app), so the code path leads
 * there; in a normal browser tab the link leads and the code is offered as
 * a secondary "Enter code instead" toggle.
 */
export function MagicLinkSentPanel({
  email,
  verifyMagicLinkOtp,
  resendMagicLink,
  onVerified,
  onBack,
}: {
  email: string;
  verifyMagicLinkOtp: (
    email: string,
    token: string,
  ) => Promise<{ error: AuthError | null; session: Session | null }>;
  resendMagicLink: () => Promise<{ error: AuthError | null }>;
  onVerified: (session: Session) => void | Promise<void>;
  onBack: () => void;
}) {
  const [showCodeForm, setShowCodeForm] = useState(() =>
    isStandaloneDisplayMode(),
  );

  return (
    <div className="text-center py-4">
      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Mail className="w-6 h-6 text-primary" />
      </div>

      {showCodeForm ? (
        <>
          <h2 className="text-lg font-medium text-on-surface mb-1">
            Enter your code
          </h2>
          <p className="text-sm text-on-surface-variant mb-6">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-on-surface">{email}</span>. Enter
            it below to sign in. (A sign-in link is also in that email, if
            you&apos;d rather use that.)
          </p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-medium text-on-surface mb-2">
            Check your email
          </h2>
          <p className="text-sm text-on-surface-variant mb-6">
            We sent a magic link to{" "}
            <span className="font-medium text-on-surface">{email}</span>
          </p>
        </>
      )}

      {showCodeForm ? (
        <OtpCodeForm
          email={email}
          verify={verifyMagicLinkOtp}
          onVerified={onVerified}
          resend={resendMagicLink}
          eventPrefix="conversion.magiclink_otp"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowCodeForm(true)}
          className="text-sm text-primary hover:text-primary/80 font-medium"
        >
          Enter code instead
        </button>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mt-6 text-sm text-primary hover:text-primary/80 font-medium"
      >
        Back to sign in
      </button>
    </div>
  );
}
