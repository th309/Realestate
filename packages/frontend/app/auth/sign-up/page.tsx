"use client";

import { Suspense, useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Lock, Loader2, AlertCircle, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { trackEvent, flush } from "@/lib/analytics/tracker";
import {
  allRequirementsMet,
  friendlyAuthError,
  getPasswordRequirements,
  readAttributionCookie,
} from "./helpers";
import { ConfirmationSent } from "./ConfirmationSent";
import { PasswordStrength } from "./PasswordStrength";
import { GoogleIcon } from "./GoogleIcon";

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpContent />
    </Suspense>
  );
}

function SignUpContent() {
  const { signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // New signups flow through /tour by default. If the user arrived with an explicit
  // ?redirect=..., preserve it via /tour?next=... so onboarding can forward them on.
  const explicitRedirect = searchParams.get("redirect");
  const redirectTo = explicitRedirect
    ? `/tour?next=${encodeURIComponent(explicitRedirect)}`
    : "/tour";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const tosRef = useRef<HTMLLabelElement>(null);
  const tosError =
    error === "You must accept the Terms of Service to create an account";

  // Track signup form shown once on mount
  useEffect(() => {
    trackEvent("conversion.signup_start", { redirect_to: redirectTo });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const requirements = getPasswordRequirements(password);

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!tosAccepted) {
      setError("You must accept the Terms of Service to create an account");
      tosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!email || !password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!allRequirementsMet(password)) {
      setError("Password does not meet all requirements");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError, session } = await signUp(
      email,
      password,
      redirectTo,
    );

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // With autoconfirm enabled, signup returns a session immediately.
    // Upsert profile row (trigger creates it, but belt-and-suspenders)
    // and send welcome email since the Supabase email hook is skipped.
    if (session) {
      trackEvent("conversion.signup_complete", { method: "email" });
      flush(); // Send queued events via sendBeacon BEFORE any navigation unmounts this page
      const supabase = createSupabaseBrowserClient();
      await supabase.from("user_profiles").upsert(
        {
          id: session.user.id,
          email: session.user.email,
          full_name:
            (session.user.user_metadata?.full_name as string) ||
            email.split("@")[0],
          tos_accepted_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      // Fire-and-forget welcome email
      fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});

      // Capture content-pipeline attribution: read the __piq_attr cookie
      // set by /go/[slug] on first touch and forward it to the backend.
      // Fire-and-forget; never block signup on attribution.
      const attributionCookie = readAttributionCookie();
      if (attributionCookie) {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        fetch(`${apiUrl}/api/auth-hooks/on-user-created`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: session.user.id,
            cookieValue: attributionCookie,
            tierAtSignup: "free",
          }),
          keepalive: true,
        }).catch(() => {});
      }

      // Honor a pending purchase intent: if the user clicked a paid CTA before
      // signing up, skip the /tour and return to /pricing so the existing
      // auto-checkout effect resumes Stripe. Otherwise use the normal flow.
      const hasCheckoutIntent =
        typeof window !== "undefined" &&
        !!window.sessionStorage.getItem("checkoutIntent");
      router.push(
        hasCheckoutIntent && explicitRedirect ? explicitRedirect : redirectTo,
      );
      return;
    }

    // Email confirmation required — show success message on this page
    setConfirmationSent(true);
    setLoading(false);
  };

  const handleOAuth = async (provider: "google") => {
    if (!tosAccepted) {
      setError("You must accept the Terms of Service to create an account");
      tosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const callbackUrl = `${window.location.origin}/auth/callback?tos=1&next=${encodeURIComponent(redirectTo)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    });

    if (authError) {
      setError(friendlyAuthError(authError.message));
      setLoading(false);
    }
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
            Create your account
          </h1>
        </div>

        {/* Confirmation Sent Success */}
        {confirmationSent ? (
          <ConfirmationSent email={email} />
        ) : (
          <>
            {/* Error Banner */}
            {error && (
              <div className="mb-6 flex items-start gap-2 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Sign-Up Form */}
            <form onSubmit={handleSignUp} className="space-y-4">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-on-surface mb-1.5"
                >
                  Email
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

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-on-surface mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
                  />
                </div>

                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <PasswordStrength requirements={requirements} />
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-on-surface mb-1.5"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
                  />
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="mt-1 text-xs text-error">
                    Passwords do not match
                  </p>
                )}
              </div>

              {/* Terms of Service Checkbox */}
              <label
                ref={tosRef}
                className={`flex items-start gap-3 cursor-pointer select-none py-1 rounded-lg transition-shadow ${
                  tosError
                    ? "ring-2 ring-error/60 ring-offset-2 ring-offset-surface-container px-2"
                    : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary/30 accent-primary"
                />
                <span className="text-sm text-on-surface-variant leading-snug">
                  I agree to the{" "}
                  <a
                    href="/about/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 font-medium underline underline-offset-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Terms of Service
                  </a>
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Account
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-outline-variant" />
              <span className="text-xs text-on-surface-variant">
                or sign up with
              </span>
              <div className="flex-1 h-px bg-outline-variant" />
            </div>

            {/* OAuth Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <GoogleIcon />
                Google
              </button>
            </div>

            {/* Sign In Link */}
            <p className="mt-8 text-center text-sm text-on-surface-variant">
              Already have an account?{" "}
              <Link
                href={
                  explicitRedirect
                    ? `/auth/sign-in?redirect=${encodeURIComponent(explicitRedirect)}`
                    : "/auth/sign-in"
                }
                className="text-primary hover:text-primary/80 font-medium"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
