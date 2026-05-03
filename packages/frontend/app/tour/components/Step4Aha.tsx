"use client";

import { useEffect } from "react";
import { useAnonymousListingPresentation } from "@/lib/data";
import { useTour } from "../TourStateProvider";
import { ListingPresentation } from "./ListingPresentation";
import { ListingPresentationLoading } from "./ListingPresentationLoading";
import { ListingPresentationError } from "./ListingPresentationError";

/**
 * Step4Aha — drives the anonymous listing-presentation lifecycle.
 *
 * Lifecycle: Idle → Pending → Success(report) | Error.
 * - Fires the mutation once on mount when persona+market are set and the
 *   mutation is still idle.
 * - useEffect deps are narrowed to the values that actually matter (isIdle
 *   flag + persona/geoId) to avoid re-firing when React Query produces a new
 *   `mutation` object identity (Phase 03 review pattern).
 */
export function Step4Aha() {
  const { session } = useTour();
  const mutation = useAnonymousListingPresentation();

  useEffect(() => {
    if (mutation.isIdle && session.persona && session.market) {
      mutation.mutate({
        sessionId: session.sessionId,
        persona: session.persona,
        market: session.market,
      });
    }
    // Hardened deps: avoid mutation identity churn; only re-fire when the
    // idle flag flips or the user picks a different persona/market.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutation.isIdle, session.persona, session.market?.geoId]);

  if (!session.persona || !session.market) {
    return (
      <p className="p-8 text-center text-on-surface-variant">
        Pick a persona and market first.
      </p>
    );
  }

  if (mutation.isPending || mutation.isIdle) {
    return (
      <ListingPresentationLoading
        marketName={session.market.name || "your market"}
      />
    );
  }

  if (mutation.isError) {
    return (
      <ListingPresentationError
        error={mutation.error as Error}
        onRetry={() =>
          mutation.mutate({
            sessionId: session.sessionId,
            persona: session.persona!,
            market: session.market!,
          })
        }
        onSignupRedirect={() => {
          window.location.href = "/auth/sign-up?from=tour-rate-limit";
        }}
      />
    );
  }

  if (mutation.isSuccess && mutation.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <ListingPresentation
          report={mutation.data}
          marketName={session.market.name}
          geographyDescription={session.market.name}
          showWatermark={true}
        />
        {/* Phase 05 mounts the inline signup form here, anchored at #signup-cta */}
        <div id="signup-cta" data-print-hide="true" />
      </div>
    );
  }

  return null;
}
