"use client";

import { useEffect } from "react";
import {
  useAnonymousListingPresentation,
  useAuthenticatedListingPresentation,
} from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useTour } from "../TourStateProvider";
import { triggerConfetti } from "../primitives/celebrations";
import { ListingPresentation } from "./ListingPresentation";
import { ListingPresentationLoading } from "./ListingPresentationLoading";
import { ListingPresentationError } from "./ListingPresentationError";
import { InlineSignupForm } from "./InlineSignupForm";
import { PersonaSpringboard } from "./PersonaSpringboard";

/**
 * Step4Aha — drives the listing-presentation lifecycle for the tour finale.
 *
 * Lifecycle: Idle → Pending → Success(report) | Error.
 * - Fires the mutation once on mount when persona+market are set and the
 *   mutation is still idle.
 * - useEffect deps are narrowed to the values that actually matter (isIdle
 *   flag + persona/geoId) to avoid re-firing when React Query produces a new
 *   `mutation` object identity (Phase 03 review pattern).
 *
 * Authed vs anonymous: signed-in users drive the report through the
 * JWT-guarded authenticated endpoint (no 1/IP/24h rate limit, no bot-UA block,
 * market name resolved server-side). Anonymous visitors keep the anon endpoint.
 * Both hooks are always instantiated (Rules of Hooks); we select the active one
 * by auth state. The success/error/loading render is shared.
 */
export function Step4Aha() {
  const { session } = useTour();
  const { user } = useAuth();
  const authed = !!user?.id;

  const anonMutation = useAnonymousListingPresentation();
  const authedMutation = useAuthenticatedListingPresentation();
  const mutation = authed ? authedMutation : anonMutation;

  useEffect(() => {
    if (mutation.isIdle && session.persona && session.market) {
      mutation.mutate({
        sessionId: session.sessionId,
        persona: session.persona,
        market: session.market,
      });
    }
    // Hardened deps: avoid mutation identity churn; only re-fire when the
    // idle flag flips or the user picks a different persona/market. `authed`
    // is included so the correct mutation fires once auth state resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutation.isIdle, authed, session.persona, session.market?.geoId]);

  // Authenticated users land the report as the "Pro unlocked" finale — fire
  // confetti once the report resolves for them.
  useEffect(() => {
    if (mutation.isSuccess && user?.id) triggerConfetti();
  }, [mutation.isSuccess, user?.id]);

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
          // Full-page nav (not router.push) so React Query cache and tour
          // session cookies clear cleanly before the signup flow.
          window.location.href = "/auth/sign-up?from=tour-rate-limit";
        }}
      />
    );
  }

  if (mutation.isSuccess && mutation.data) {
    // On a bare-URL entry (e.g. /tour?...&market=metro-39580) the client-side
    // market name is empty — the authed endpoint resolved it server-side for
    // the narrative, but the header prop still needs a value. Fall back to the
    // same neutral label the loading state uses so the header is never blank.
    const displayName = session.market.name || "your market";
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        {authed && (
          <div className="mb-6 rounded-2xl bg-primary-container px-6 py-5 text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-on-primary-container">
              🎉 You&apos;re set with Pro
            </p>
            <h2 className="mt-1 text-xl font-semibold text-on-surface">
              14 days of full access — here&apos;s your market, in full.
            </h2>
          </div>
        )}
        <ListingPresentation
          report={mutation.data}
          marketName={displayName}
          geographyDescription={displayName}
          showWatermark={!authed}
        />
        {authed ? (
          <PersonaSpringboard />
        ) : (
          <div data-print-hide="true">
            <InlineSignupForm />
          </div>
        )}
      </div>
    );
  }

  return null;
}
