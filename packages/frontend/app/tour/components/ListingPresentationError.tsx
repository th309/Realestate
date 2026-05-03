"use client";

import { TourRateLimitError } from "@/lib/data/fetchers/anonymous-listing-presentation";

interface Props {
  error: Error;
  onRetry: () => void;
  onSignupRedirect?: () => void;
}

export function ListingPresentationError({
  error,
  onRetry,
  onSignupRedirect,
}: Props) {
  const isRateLimit =
    error instanceof TourRateLimitError ||
    error.message === "rate_limited" ||
    (error as Error & { retryAfter?: number }).retryAfter != null;

  if (isRateLimit) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-2xl font-semibold text-on-surface">
          You&apos;ve used today&apos;s free demo
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">
          Sign up free to generate unlimited reports — and your first one is
          saved and waiting.
        </p>
        <button
          type="button"
          onClick={onSignupRedirect}
          className="mt-6 rounded-full bg-primary-dark px-6 py-3 text-sm font-medium text-white"
        >
          Sign up free →
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <p className="text-xl font-semibold text-on-surface">
        We couldn&apos;t build that report.
      </p>
      <p className="mt-2 text-sm text-on-surface-variant">{error.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary"
      >
        Try again
      </button>
    </div>
  );
}
