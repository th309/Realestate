"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  CreditCard,
  ExternalLink,
  Plus,
  Minus,
  Loader2,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { PlanComparisonCards } from "./PlanComparisonCards";
import { useOrg } from "../../../hooks/useOrg";
import {
  fetchOrgBilling,
  createOrgBillingPortal,
  updateOrgSeats,
} from "@/lib/data";
import type { OrgBillingUsage } from "@/lib/data";
import { SeatUsageBar } from "../../../components/SeatUsageBar";

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Billing management page for enterprise admin.
 * Shows plan summary, seat usage, seat adjustment, and portal link.
 */
export default function OrgAdminBilling() {
  const { org } = useOrg();

  const [billing, setBilling] = useState<OrgBillingUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seatDelta, setSeatDelta] = useState(0);
  const [updatingSeats, setUpdatingSeats] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const loadBilling = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrgBilling(org.slug);
      setBilling(data);
      setSeatDelta(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  const handleUpdateSeats = useCallback(async () => {
    if (!org || !billing || seatDelta === 0) return;
    setUpdatingSeats(true);
    try {
      await updateOrgSeats(
        org.slug,
        (billing.additional_seats ?? 0) + seatDelta,
      );
      await loadBilling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update seats");
    } finally {
      setUpdatingSeats(false);
    }
  }, [org, billing, seatDelta, loadBilling]);

  const handleOpenPortal = useCallback(async () => {
    if (!org) return;
    setPortalLoading(true);
    try {
      const result = await createOrgBillingPortal(org.slug);
      window.location.href = result.portal_url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("No billing account") || msg.includes("subscription")) {
        // User was manually upgraded — no Stripe customer yet.
        // Use the same trial checkout as the grace banner.
        try {
          const { setupEnterpriseBilling } = await import("@/lib/data");
          const { checkout_url } = await setupEnterpriseBilling();
          window.location.href = checkout_url;
          return;
        } catch {
          setError("Unable to set up billing. Please try again.");
        }
      } else {
        setError(msg || "Failed to open billing portal");
      }
      setPortalLoading(false);
    }
  }, [org]);

  const totalSeats = billing
    ? (billing.seats_included ?? 0) + (billing.additional_seats ?? 0)
    : (org?.seat_limit ?? 0);
  const projectedTotal = totalSeats + seatDelta;

  const cardClass = "bg-surface-container-low rounded-xl shadow-sm p-6";

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  if (error && !billing) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-on-surface-variant">{error}</p>
          <button
            onClick={() => void loadBilling()}
            className="mt-3 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-on-surface">Billing</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Manage your subscription and seats
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/20 p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Plan context banner */}
      {billing && (
        <div className="mb-6 rounded-xl bg-primary/5 border border-primary/20 p-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {/* Plan name badge */}
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <span className="text-lg font-semibold text-on-surface">
                {billing.plan_name}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  billing.status === "active"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}
              >
                {billing.status.charAt(0).toUpperCase() +
                  billing.status.slice(1)}
              </span>
            </div>

            {/* Divider (hidden on mobile) */}
            <div className="hidden sm:block h-8 w-px bg-outline-variant" />

            {/* Billing period */}
            {billing.current_period_start && billing.current_period_end && (
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>
                  {formatDate(billing.current_period_start)} &mdash;{" "}
                  {formatDate(billing.current_period_end)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Seat usage */}
        <div className={cardClass}>
          <h2 className="text-sm font-medium text-on-surface-variant tracking-wide mb-4">
            SEAT USAGE
          </h2>
          <SeatUsageBar used={billing?.seats_used ?? 0} total={totalSeats} />
          <div className="mt-3 text-xs text-on-surface-variant space-y-0.5">
            <p>{billing?.seats_included ?? 0} seats included in plan</p>
            <p>{billing?.additional_seats ?? 0} additional seats purchased</p>
          </div>
        </div>

        {/* Seat adjustment */}
        <div className={cardClass}>
          <h2 className="text-sm font-medium text-on-surface-variant tracking-wide mb-4">
            ADJUST SEATS
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() =>
                setSeatDelta((d) =>
                  Math.max(d - 1, -(billing?.additional_seats ?? 0)),
                )
              }
              disabled={
                seatDelta <= -(billing?.additional_seats ?? 0) || updatingSeats
              }
              className="rounded-full p-2 border border-outline-variant hover:bg-surface-container-high transition-colors disabled:opacity-40"
              aria-label="Remove seat"
            >
              <Minus className="w-4 h-4 text-on-surface" />
            </button>
            <div className="text-center min-w-[80px]">
              <p className="text-2xl font-semibold text-on-surface">
                {projectedTotal}
              </p>
              <p className="text-xs text-on-surface-variant">total seats</p>
            </div>
            <button
              onClick={() => setSeatDelta((d) => d + 1)}
              disabled={updatingSeats}
              className="rounded-full p-2 border border-outline-variant hover:bg-surface-container-high transition-colors disabled:opacity-40"
              aria-label="Add seat"
            >
              <Plus className="w-4 h-4 text-on-surface" />
            </button>
          </div>
          {seatDelta !== 0 && (
            <div className="flex items-center gap-3">
              <p className="text-sm text-on-surface-variant">
                {seatDelta > 0 ? `+${seatDelta}` : seatDelta} seat
                {Math.abs(seatDelta) !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => void handleUpdateSeats()}
                disabled={updatingSeats}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {updatingSeats ? "Updating..." : "Apply"}
              </button>
              <button
                onClick={() => setSeatDelta(0)}
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Manage billing */}
        <div className={cardClass}>
          <h2 className="text-sm font-medium text-on-surface-variant tracking-wide mb-4">
            BILLING PORTAL
          </h2>
          <p className="text-sm text-on-surface-variant mb-4">
            View invoices, update payment method, and manage your subscription
            in the Stripe billing portal.
          </p>
          <button
            onClick={() => void handleOpenPortal()}
            disabled={portalLoading}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {portalLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            Manage Billing
          </button>
        </div>
      </div>

      {/* Plan comparison cards */}
      <PlanComparisonCards
        currentPlanName={billing?.plan_name ?? null}
        onSwitchPlan={() => void handleOpenPortal()}
        switchLoading={portalLoading}
      />
    </div>
  );
}
