"use client";

import type { FormEventHandler, RefObject } from "react";
import Link from "next/link";
import { Lock, Loader2, AlertCircle, Mail } from "lucide-react";
import { getPasswordRequirements } from "./helpers";
import { PasswordStrength } from "./PasswordStrength";
import { GoogleIcon } from "./GoogleIcon";

interface SignUpCredentialsFormProps {
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  loading: boolean;
  error: string | null;
  tosAccepted: boolean;
  onTosAcceptedChange: (value: boolean) => void;
  tosRef: RefObject<HTMLLabelElement | null>;
  tosError: boolean;
  explicitRedirect: string | null;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onOAuth: (provider: "google") => void;
}

/**
 * Credential-entry view of the sign-up page: email + password fields, the ToS
 * gate, and the OAuth alternative. Purely presentational — every piece of auth
 * state and all submit/OAuth behaviour lives in the parent page, which owns the
 * choice between this view and the OTP confirmation view.
 */
export function SignUpCredentialsForm({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  loading,
  error,
  tosAccepted,
  onTosAcceptedChange,
  tosRef,
  tosError,
  explicitRedirect,
  onSubmit,
  onOAuth,
}: SignUpCredentialsFormProps) {
  const requirements = getPasswordRequirements(password);

  return (
    <>
      {/* Error Banner */}
      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sign-Up Form */}
      <form onSubmit={onSubmit} className="space-y-4">
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
              onChange={(e) => onEmailChange(e.target.value)}
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
              onChange={(e) => onPasswordChange(e.target.value)}
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
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              disabled={loading}
              className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
            />
          </div>
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <p className="mt-1 text-xs text-error">Passwords do not match</p>
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
            onChange={(e) => onTosAcceptedChange(e.target.checked)}
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
        <span className="text-xs text-on-surface-variant">or sign up with</span>
        <div className="flex-1 h-px bg-outline-variant" />
      </div>

      {/* OAuth Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onOAuth("google")}
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
  );
}
