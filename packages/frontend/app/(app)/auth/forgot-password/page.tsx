"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import {
  Building2,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth";
import { OtpCodeForm } from "@/components/auth/OtpCodeForm";
import { isStandaloneDisplayMode } from "@/lib/pwa/is-standalone";

type Stage = "request" | "sent" | "code-verified";

export default function ForgotPasswordPage() {
  const { resetPassword, verifyRecoveryOtp, updatePassword } = useAuth();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("request");
  // Installed PWA: email links open the phone's browser, not the app, so the
  // code path leads there. In a normal browser tab the link leads and the
  // code is offered as a secondary "Enter code instead" toggle.
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);

    const { error: authError } = await resetPassword(email);

    if (authError) {
      setError(authError.message);
    } else {
      setStage("sent");
      setShowCodeForm(isStandaloneDisplayMode());
    }
    setLoading(false);
  };

  // A recovery OTP verification establishes a real session (that's what
  // authorizes the updateUser({password}) call below) — but the destination
  // is always the new-password form, never straight into the app.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleOtpVerified = async (_session: Session) => {
    setStage("code-verified");
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!newPassword) return;

    setSavingPassword(true);
    setError(null);

    const { error: updateError } = await updatePassword(newPassword);

    if (updateError) {
      setError(updateError.message);
      setSavingPassword(false);
      return;
    }

    // Matches the existing link-flow landing (auth/callback?type=recovery
    // redirects to the same destination). Full-page nav, consistent with
    // the other post-auth redirects in this app.
    window.location.href = "/account?reset=true";
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface-container rounded-2xl border border-outline-variant p-8 shadow-sm">
        {/* Logo / Title */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-on-surface">
            Reset your password
          </h1>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {stage === "code-verified" ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <p className="text-sm text-on-surface-variant text-center mb-2">
              Choose a new password for{" "}
              <span className="font-medium text-on-surface">{email}</span>.
            </p>
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-on-surface mb-1.5"
              >
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                <input
                  id="new-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Enter a new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={savingPassword}
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="confirm-new-password"
                className="block text-sm font-medium text-on-surface mb-1.5"
              >
                Confirm new password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                <input
                  id="confirm-new-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={savingPassword}
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
              Set new password
            </button>
          </form>
        ) : stage === "sent" ? (
          <div className="text-center py-2">
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
                  <span className="font-medium text-on-surface">{email}</span>.
                  Enter it below to continue. (A reset link is also in that
                  email, if you&apos;d rather use that.)
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-medium text-on-surface mb-2">
                  Check your email
                </h2>
                <p className="text-sm text-on-surface-variant mb-6">
                  We sent a password reset link to{" "}
                  <span className="font-medium text-on-surface">{email}</span>.
                  Click the link, or enter the 6-digit code from the same email
                  below.
                </p>
              </>
            )}

            {showCodeForm ? (
              <OtpCodeForm
                email={email}
                verify={verifyRecoveryOtp}
                onVerified={handleOtpVerified}
                resend={() => resetPassword(email)}
                eventPrefix="conversion.recovery_otp"
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

            <p className="mt-6 text-sm text-on-surface-variant">
              <Link
                href="/auth/sign-in"
                className="text-primary hover:text-primary/80 font-medium"
              >
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <>
            {/* Description */}
            <p className="text-sm text-on-surface-variant text-center mb-6">
              Enter your email address and we&apos;ll send you a link (and a
              6-digit code) to reset your password.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-on-surface mb-1.5"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Reset Link
              </button>
            </form>

            {/* Back to Sign In */}
            <div className="mt-6 text-center">
              <Link
                href="/auth/sign-in"
                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
