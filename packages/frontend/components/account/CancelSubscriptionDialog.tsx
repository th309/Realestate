"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import {
  fetchSubscriptionStatus,
  cancelSubscription,
  resumeSubscription,
} from "@/lib/data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CancelSubscriptionDialogProps {
  tierLabel: string;
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Date formatting helper
// ---------------------------------------------------------------------------

function formatPeriodEndDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Cancel / Resume subscription actions with confirmation dialog.
 *
 * Renders one of three states:
 * 1. "Cancel Subscription" button (no pending cancellation)
 * 2. Pending cancellation banner with "Resume Subscription" button
 * 3. Confirmation dialog (open after clicking Cancel)
 */
export function CancelSubscriptionDialog({
  tierLabel,
  onComplete,
}: CancelSubscriptionDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [periodEndDate, setPeriodEndDate] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Fetch subscription status on mount
  useEffect(() => {
    let cancelled = false;
    fetchSubscriptionStatus()
      .then((status) => {
        if (cancelled) return;
        setCancelAtPeriodEnd(status.cancelAtPeriodEnd);
        setPeriodEndDate(status.currentPeriodEnd);
      })
      .catch(() => {
        // Non-critical — fallback to showing cancel button
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync native dialog open/close with React state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogOpen && !dialog.open) {
      dialog.showModal();
    } else if (!dialogOpen && dialog.open) {
      dialog.close();
    }
  }, [dialogOpen]);

  const handleCancel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await cancelSubscription();
      setCancelAtPeriodEnd(true);
      setPeriodEndDate(result.currentPeriodEnd);
      setDialogOpen(false);
      onComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel subscription",
      );
    } finally {
      setLoading(false);
    }
  }, [onComplete]);

  const handleResume = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await resumeSubscription();
      setCancelAtPeriodEnd(false);
      onComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resume subscription",
      );
    } finally {
      setLoading(false);
    }
  }, [onComplete]);

  if (statusLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading subscription details...
      </div>
    );
  }

  // --- Pending cancellation banner ---
  if (cancelAtPeriodEnd && periodEndDate) {
    return (
      <div className="space-y-3">
        {error && (
          <div className="p-3 rounded-lg bg-error/10 text-error text-sm">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-error/30 bg-error/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-on-surface">
                Cancellation scheduled
              </p>
              <p className="text-sm text-on-surface-variant mt-1">
                Your {tierLabel} plan will end on{" "}
                <span className="font-medium text-on-surface">
                  {formatPeriodEndDate(periodEndDate)}
                </span>
                . You will retain full access until then, after which your
                account will be downgraded to the Free plan.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResume}
            disabled={loading}
            className="mt-3 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Resume Subscription
          </button>
        </div>
      </div>
    );
  }

  // --- Cancel button + confirmation dialog ---
  return (
    <>
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-error/10 text-error text-sm">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="px-4 py-2 rounded-lg text-sm font-medium border border-error/30 text-error hover:bg-error/5 transition-colors inline-flex items-center gap-2"
      >
        Cancel Subscription
      </button>

      {/* M3 Dialog — uses native <dialog> for accessibility */}
      <dialog
        ref={dialogRef}
        onClose={() => setDialogOpen(false)}
        className="rounded-[28px] bg-surface-container-high shadow-lg p-0 backdrop:bg-black/50 max-w-md w-full"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-error" />
            </div>
            <h3 className="text-lg font-semibold text-on-surface">
              Cancel subscription?
            </h3>
          </div>

          <div className="space-y-3 text-sm text-on-surface-variant">
            <p>
              Are you sure you want to cancel your{" "}
              <span className="font-medium text-on-surface">{tierLabel}</span>{" "}
              plan?
            </p>
            {periodEndDate && (
              <p>
                You will keep access to all {tierLabel} features until{" "}
                <span className="font-medium text-on-surface">
                  {formatPeriodEndDate(periodEndDate)}
                </span>
                .
              </p>
            )}
            <p>
              After that, your account will be downgraded to the Free plan. You
              can resume your subscription at any time before the period ends.
            </p>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-error/10 text-error text-sm">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              disabled={loading}
              className="px-4 py-2 rounded-full text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              Keep My Plan
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 rounded-full text-sm font-medium bg-error text-white hover:bg-error/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Cancel Subscription
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
