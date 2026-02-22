'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

type AuthMode = 'password' | 'magic-link';

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-full max-w-md bg-surface-container rounded-2xl border border-outline-variant p-8 animate-pulse">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-surface-container-highest rounded-xl mb-4" />
            <div className="h-6 w-48 bg-surface-container-highest rounded" />
          </div>
          <div className="space-y-4">
            <div className="h-10 bg-surface-container-highest rounded-lg" />
            <div className="h-10 bg-surface-container-highest rounded-lg" />
            <div className="h-10 bg-surface-container-highest rounded-lg" />
          </div>
        </div>
      </div>
    }>
      <SignInPageContent />
    </Suspense>
  );
}

function SignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';
  const callbackError = searchParams.get('error');

  const { signInWithPassword, signInWithMagicLink, signInWithOAuth } =
    useAuth();

  const [mode, setMode] = useState<AuthMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    callbackError === 'auth_callback_failed'
      ? 'Authentication failed. Please try again.'
      : null
  );
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handlePasswordSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    const { error: authError } = await signInWithPassword(email, password);

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      router.push(redirectTo);
    }
  };

  const handleMagicLinkSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);

    const { error: authError } = await signInWithMagicLink(email);

    if (authError) {
      setError(authError.message);
    } else {
      setMagicLinkSent(true);
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: 'google' | 'apple' | 'github') => {
    setLoading(true);
    setError(null);

    const { error: authError } = await signInWithOAuth(provider, redirectTo);

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
    // OAuth redirects externally, so loading stays true unless there's an error
  };

  const handlePasskey = () => {
    // WebAuthn/Passkey support is not yet available
    setError('Passkeys coming soon');
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
            Sign in to PropertyIQ
          </h1>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Magic Link Success */}
        {magicLinkSent ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-medium text-on-surface mb-2">
              Check your email
            </h2>
            <p className="text-sm text-on-surface-variant mb-6">
              We sent a magic link to{' '}
              <span className="font-medium text-on-surface">{email}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                setMagicLinkSent(false);
                setMode('password');
              }}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            {/* Sign-In Form */}
            <form
              onSubmit={
                mode === 'password'
                  ? handlePasswordSignIn
                  : handleMagicLinkSignIn
              }
              className="space-y-4"
            >
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

              {/* Password (only in password mode) */}
              {mode === 'password' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-on-surface"
                    >
                      Password
                    </label>
                    <Link
                      href="/auth/forgot-password"
                      className="text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                    <input
                      id="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'password' ? 'Sign In' : 'Send Magic Link'}
              </button>
            </form>

            {/* Mode Toggle */}
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'password' ? 'magic-link' : 'password');
                  setError(null);
                }}
                disabled={loading}
                className="text-sm text-primary hover:text-primary/80 font-medium disabled:opacity-50"
              >
                {mode === 'password'
                  ? 'Sign in with magic link'
                  : 'Use password instead'}
              </button>
            </div>

            {/* Passkey Button */}
            <div className="mt-4">
              <button
                type="button"
                onClick={handlePasskey}
                disabled={loading}
                className="w-full px-4 py-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                Sign in with Passkey
              </button>
            </div>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-outline-variant" />
              <span className="text-xs text-on-surface-variant">
                or continue with
              </span>
              <div className="flex-1 h-px bg-outline-variant" />
            </div>

            {/* OAuth Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleOAuth('google')}
                disabled={loading}
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
              <button
                type="button"
                onClick={() => handleOAuth('apple')}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Apple
              </button>
              <button
                type="button"
                onClick={() => handleOAuth('github')}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                GitHub
              </button>
            </div>

            {/* Sign Up Link */}
            <p className="mt-8 text-center text-sm text-on-surface-variant">
              Don&apos;t have an account?{' '}
              <Link
                href={redirectTo !== '/dashboard' ? `/auth/sign-up?redirect=${encodeURIComponent(redirectTo)}` : '/auth/sign-up'}
                className="text-primary hover:text-primary/80 font-medium"
              >
                Sign up
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
