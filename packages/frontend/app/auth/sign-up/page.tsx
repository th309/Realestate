'use client';

import { Suspense, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  Lock,
  Loader2,
  AlertCircle,
  Check,
  Circle,
  Mail,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface PasswordRequirement {
  label: string;
  met: boolean;
}

function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'At least 1 uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'At least 1 lowercase letter', met: /[a-z]/.test(password) },
    { label: 'At least 1 number', met: /[0-9]/.test(password) },
  ];
}

function allRequirementsMet(password: string): boolean {
  return getPasswordRequirements(password).every((r) => r.met);
}

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
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const requirements = getPasswordRequirements(password);

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!tosAccepted) {
      setError('You must accept the Terms of Service to create an account');
      return;
    }
    if (!email || !password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!allRequirementsMet(password)) {
      setError('Password does not meet all requirements');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError, session } = await signUp(email, password);

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // With autoconfirm enabled, signup returns a session immediately.
    // Record ToS acceptance and redirect to dashboard.
    if (session) {
      const supabase = createSupabaseBrowserClient();
      await supabase
        .from('user_profiles')
        .update({ tos_accepted_at: new Date().toISOString() })
        .eq('id', session.user.id);

      router.push(redirectTo);
      return;
    }

    // Email confirmation required — show success message on this page
    setConfirmationSent(true);
    setLoading(false);
  };

  const handleOAuth = async (provider: 'google') => {
    if (!tosAccepted) {
      setError('You must accept the Terms of Service to create an account');
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
      setError(authError.message);
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
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-medium text-on-surface mb-2">
              Check your email
            </h2>
            <p className="text-sm text-on-surface-variant mb-6">
              We sent a confirmation link to{' '}
              <span className="font-medium text-on-surface">{email}</span>.
              Click the link in the email to activate your account.
            </p>
            <Link
              href="/auth/sign-in"
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Back to sign in
            </Link>
          </div>
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
                  <div
                    data-testid="password-strength"
                    className="mt-2 space-y-1"
                  >
                    {requirements.map((req) => (
                      <div
                        key={req.label}
                        className="flex items-center gap-2 text-xs"
                      >
                        {req.met ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-on-surface-variant/40" />
                        )}
                        <span
                          className={
                            req.met
                              ? 'text-green-600'
                              : 'text-on-surface-variant/60'
                          }
                        >
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
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
                {confirmPassword.length > 0 &&
                  password !== confirmPassword && (
                    <p className="mt-1 text-xs text-error">
                      Passwords do not match
                    </p>
                  )}
              </div>

              {/* Terms of Service Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary/30 accent-primary"
                />
                <span className="text-sm text-on-surface-variant leading-snug">
                  I agree to the{' '}
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
                disabled={loading || !tosAccepted}
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
                onClick={() => handleOAuth('google')}
                disabled={loading || !tosAccepted}
                className="flex-1 px-4 py-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </button>
            </div>

            {/* Sign In Link */}
            <p className="mt-8 text-center text-sm text-on-surface-variant">
              Already have an account?{' '}
              <Link
                href={redirectTo !== '/dashboard' ? `/auth/sign-in?redirect=${encodeURIComponent(redirectTo)}` : '/auth/sign-in'}
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
