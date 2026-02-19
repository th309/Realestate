'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import {
  Building2,
  Mail,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);

    const { error: authError } = await resetPassword(email);

    if (authError) {
      setError(authError.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
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

        {/* Success State */}
        {success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-medium text-on-surface mb-2">
              Check your email
            </h2>
            <p className="text-sm text-on-surface-variant mb-6">
              We sent a password reset link to{' '}
              <span className="font-medium text-on-surface">{email}</span>.
              Click the link to reset your password.
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
            {/* Description */}
            <p className="text-sm text-on-surface-variant text-center mb-6">
              Enter your email address and we&apos;ll send you a link to reset
              your password.
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
