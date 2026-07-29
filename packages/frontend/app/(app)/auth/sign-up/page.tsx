"use client";

import { Suspense, useState, useEffect, useRef, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { trackEvent, flush } from "@/lib/analytics/tracker";
import { createSignupPathEngagementTracker } from "@/lib/analytics/signup-path-engagement";
import {
  allRequirementsMet,
  classifyAuthError,
  friendlyAuthError,
} from "./helpers";
import { OtpConfirmation } from "./OtpConfirmation";
import { SignUpCredentialsForm } from "./SignUpCredentialsForm";
import { completeSignup } from "./complete-signup";
import { assertNever, classifySignupResult } from "./signup-result";

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
  // `resume=fresh` wipes any stale piq_tour state left in this browser by a PRIOR
  // account (useTourSession honors it by clearing localStorage + cookie), so a brand-new
  // signup always starts at the persona picker instead of resuming someone else's
  // finished tour (e.g. a leftover Bloomington/step4). The pre-signup anonymous-tour
  // resume is a SEPARATE path (auth/callback ?phase=celebrate) and is intentionally
  // left untouched so those users keep the market they already picked.
  const explicitRedirect = searchParams.get("redirect");
  const redirectTo = explicitRedirect
    ? `/tour?next=${encodeURIComponent(explicitRedirect)}&resume=fresh`
    : "/tour?resume=fresh";

  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);
  const tosRef = useRef<HTMLLabelElement>(null);
  const tosError =
    error === "You must accept the Terms of Service to create an account";

  // Track signup form shown once on mount
  useEffect(() => {
    trackEvent("conversion.signup_start", { redirect_to: redirectTo });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // signup_start fires on mount, before a path is chosen, so it cannot say
  // whether an abandonment belongs to the email form or the Google button. The
  // OAuth side already announces itself (signup_oauth_click); this is the email
  // side's equivalent. Lazy useState initialiser so the latch is created once
  // per mount and survives re-renders — a ref would work equally well, but the
  // stored value here IS the marker function returned by the factory.
  const [markEmailPathEngaged] = useState(createSignupPathEngagementTracker);

  // Restore the OTP screen after a refresh. Runs client-only AFTER hydration so
  // the server and first client render match (no hydration mismatch); the
  // pending email is persisted in sessionStorage when we transition to it.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("piq_signup_pending");
      if (raw) {
        const parsed = JSON.parse(raw) as { email?: string };
        if (parsed.email) {
          // One-time restore from sessionStorage after hydration; the
          // set-state-in-effect "cascading render" rule is a false positive here.
          /* eslint-disable react-hooks/set-state-in-effect */
          setEmail(parsed.email);
          setAwaitingOtp(true);
          /* eslint-enable react-hooks/set-state-in-effect */
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Every rejection below used to return silently, so a visitor who fought the
  // form and gave up was indistinguishable in the data from one who never
  // typed anything -- both simply stopped after signup_start. That blind spot
  // is why the drop between signup_start and signup_pending_confirmation could
  // not be attributed to a cause. Emit the reason instead of guessing later.
  const trackSubmitBlocked = (reason: string) => {
    trackEvent("conversion.signup_submit_blocked", { reason });
    flush();
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!tosAccepted) {
      trackSubmitBlocked("tos_not_accepted");
      setError("You must accept the Terms of Service to create an account");
      tosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!email || !password || !confirmPassword) return;

    if (password !== confirmPassword) {
      trackSubmitBlocked("password_mismatch");
      setError("Passwords do not match");
      return;
    }

    if (!allRequirementsMet(password)) {
      trackSubmitBlocked("password_requirements_unmet");
      setError("Password does not meet all requirements");
      return;
    }

    setLoading(true);
    setError(null);

    const {
      error: authError,
      session,
      user,
    } = await signUp(email, password, redirectTo);

    // One exhaustive verdict instead of a chain ending in an implicit "else it
    // must have worked". That else is what let a null user be announced as a
    // sent confirmation code — see signup-result.ts.
    const outcome = classifySignupResult({
      error: authError,
      session,
      user,
    });

    // A switch, not an if-chain: every case returns, so the assertNever below
    // narrows to `never` and a future SignupOutcome member cannot compile until
    // it is handled here. An if-chain would let it fall silently into the
    // "code was sent" path at the bottom — the same bug shape this replaced.
    switch (outcome) {
      case "error": {
        // authError is non-null whenever the outcome is "error" (it is derived
        // from exactly that field), but the link is invisible to TypeScript
        // across the call, so fall back rather than assert non-null.
        const message =
          authError?.message ?? "We couldn't create your account.";
        // Category only — never the raw provider string (see classifyAuthError).
        trackEvent("conversion.signup_submit_error", {
          reason: classifyAuthError(message),
        });
        flush();
        setError(message);
        setLoading(false);
        return;
      }

      // Autoconfirm path (rare in prod): a session is returned immediately.
      case "autoconfirmed": {
        if (session) {
          const destination = await completeSignup(session, {
            email,
            explicitRedirect,
            redirectTo,
            method: "email",
          });
          router.push(destination);
          return;
        }
        // Unreachable — the outcome is derived from `session` being truthy.
        // Stopping here is still correct: never fall through to the OTP screen.
        setLoading(false);
        return;
      }

      // Already-registered (confirmed) users get an obfuscated user with no
      // identities and no session — route them to sign in, don't show OTP.
      case "already_registered": {
        trackSubmitBlocked("already_registered");
        setError("This email is already registered. Please sign in instead.");
        setLoading(false);
        return;
      }

      // No error, no session, no user. Nothing was created and no code was
      // sent, so showing the code screen strands the visitor waiting on an
      // email that will never arrive — and logs a pending confirmation that
      // never happened.
      case "no_user": {
        trackSubmitBlocked("no_user_returned");
        setError(
          "Something went wrong creating your account. Please try again.",
        );
        setLoading(false);
        return;
      }

      // Brand-new OR existing-unconfirmed: Supabase sent a 6-digit OTP code.
      // Persist the email so a refresh on the OTP screen recovers, record the
      // funnel stage, and show the code-entry screen.
      case "awaiting_otp": {
        try {
          window.sessionStorage.setItem(
            "piq_signup_pending",
            JSON.stringify({ email }),
          );
        } catch {
          /* ignore */
        }
        trackEvent("conversion.signup_pending_confirmation", {
          method: "email",
        });
        flush();
        setAwaitingOtp(true);
        setLoading(false);
        return;
      }
    }

    assertNever(outcome);
  };

  const handleOtpVerified = async (session: Session) => {
    try {
      window.sessionStorage.removeItem("piq_signup_pending");
    } catch {
      /* ignore */
    }
    const destination = await completeSignup(session, {
      email,
      explicitRedirect,
      redirectTo,
      method: "email",
    });
    router.push(destination);
  };

  // The OAuth branch had NO instrumentation of any kind, which made a real
  // question unanswerable from data: when zero Google signups land in a month,
  // is the button not being clicked, or is the flow broken? These three events
  // separate those cases. Each flushes immediately, because signInWithOAuth
  // does a full-page redirect that would discard the batched queue.
  const handleOAuth = async (provider: "google") => {
    if (!tosAccepted) {
      trackEvent("conversion.signup_oauth_blocked", {
        provider,
        reason: "tos_not_accepted",
      });
      flush();
      setError("You must accept the Terms of Service to create an account");
      tosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setLoading(true);
    setError(null);

    trackEvent("conversion.signup_oauth_click", { provider });
    flush();

    const supabase = createSupabaseBrowserClient();
    const callbackUrl = `${window.location.origin}/auth/callback?tos=1&next=${encodeURIComponent(redirectTo)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    });

    if (authError) {
      trackEvent("conversion.signup_oauth_error", {
        provider,
        reason: classifyAuthError(authError.message),
      });
      flush();
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

        {/* OTP code entry (post-signup) */}
        {awaitingOtp ? (
          <OtpConfirmation email={email} onVerified={handleOtpVerified} />
        ) : (
          <SignUpCredentialsForm
            email={email}
            onEmailChange={(value) => {
              markEmailPathEngaged("email");
              setEmail(value);
            }}
            password={password}
            onPasswordChange={(value) => {
              markEmailPathEngaged("password");
              setPassword(value);
            }}
            confirmPassword={confirmPassword}
            onConfirmPasswordChange={(value) => {
              markEmailPathEngaged("confirm_password");
              setConfirmPassword(value);
            }}
            loading={loading}
            error={error}
            tosAccepted={tosAccepted}
            onTosAcceptedChange={(value) => {
              markEmailPathEngaged("tos");
              setTosAccepted(value);
            }}
            tosRef={tosRef}
            tosError={tosError}
            explicitRedirect={explicitRedirect}
            onSubmit={handleSignUp}
            onOAuth={handleOAuth}
          />
        )}
      </div>
    </div>
  );
}
