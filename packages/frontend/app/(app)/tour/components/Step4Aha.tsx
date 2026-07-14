"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAnonymousListingPresentation,
  useAuthenticatedListingPresentation,
  updateChecklistTask,
  type AnonReportResponse,
} from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useTour } from "../TourStateProvider";
import { triggerConfetti } from "../primitives/celebrations";
import { readReportCache, writeReportCache } from "../lib/reportCache";
import { ListingPresentation } from "./ListingPresentation";
import { HomebuyerFinale } from "./finale/HomebuyerFinale";
import { InvestorFinale } from "./finale/InvestorFinale";
import { ListingPresentationLoading } from "./ListingPresentationLoading";
import { ListingPresentationError } from "./ListingPresentationError";
import { InlineSignupForm } from "./InlineSignupForm";
import { PersonaSpringboard } from "./PersonaSpringboard";

/**
 * Step4Aha — drives the listing-presentation lifecycle for the tour finale.
 *
 * Lifecycle: restore-from-cache → (Idle → Pending → Success | Error).
 * - On mount it first checks the session report cache (keyed by persona+market).
 *   A hit renders the finale instantly; a miss fires the generation mutation.
 * - This kills the "finale regenerates on browser Back" bug (#5): the report is
 *   persisted on success and restored on remount instead of being recomputed.
 * - useEffect deps are narrowed to the values that actually matter (cache-checked
 *   flag + cached report + isIdle + persona/geoId) to avoid re-firing when React
 *   Query produces a new `mutation` object identity (Phase 03 review pattern).
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

  // Restore a previously generated report (#5). Done in a post-mount effect, not
  // during render, to stay hydration-safe (mirrors useTourSession's storage
  // handling). `restoreChecked` gates the fetch so we never race a cache hit
  // against a fresh generation.
  const [cachedReport, setCachedReport] = useState<AnonReportResponse | null>(
    null,
  );
  const [restoreChecked, setRestoreChecked] = useState(false);

  useEffect(() => {
    setCachedReport(readReportCache(session.persona, session.market));
    setRestoreChecked(true);
  }, [session.persona, session.market?.geoLevel, session.market?.geoId]);

  const firedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Only fetch once the cache has been checked AND it was a miss.
    if (!restoreChecked || cachedReport) return;
    if (!session.persona || !session.market) return;
    // Fire the generation EXACTLY ONCE per (persona, market). A ref guard means
    // a dev StrictMode double-invoke — or any remount-less re-render — can't fire
    // a second request that would trip the 1/IP/24h anon limit on its own call.
    const key = `${session.persona}:${session.market.geoLevel}-${session.market.geoId}`;
    if (firedKeyRef.current === key) return;
    if (mutation.isIdle) {
      firedKeyRef.current = key;
      mutation.mutate({
        sessionId: session.sessionId,
        persona: session.persona,
        market: session.market,
      });
    }
    // Hardened deps: avoid mutation identity churn; only re-fire when the cache
    // check resolves to a miss or the user picks a different persona/market.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    restoreChecked,
    cachedReport,
    mutation.isIdle,
    authed,
    session.persona,
    session.market?.geoLevel,
    session.market?.geoId,
  ]);

  // Persist the freshly generated report so a later remount restores it.
  useEffect(() => {
    if (mutation.isSuccess && mutation.data) {
      writeReportCache(session.persona, session.market, mutation.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mutation.isSuccess,
    mutation.data,
    session.persona,
    session.market?.geoId,
  ]);

  // Authenticated users land the report as the "Pro unlocked" finale — fire
  // confetti once the report resolves for them (fresh generation only, not on a
  // restored-from-cache revisit).
  useEffect(() => {
    if (mutation.isSuccess && user?.id) triggerConfetti();
  }, [mutation.isSuccess, user?.id]);

  // Mark the onboarding checklist's "read your first report" task complete —
  // signed-in only (anonymous tour-takers have no user_profiles row to write
  // to), fresh generation only (mirrors the confetti trigger above, not a
  // restored-from-cache revisit). Ref-guarded so the transition to success
  // notifies the checklist exactly once per mount, not on every re-render
  // while already succeeded. Best-effort side signal — a failure here must
  // never surface as a user-facing error in the tour flow.
  const checklistNotifiedRef = useRef(false);
  useEffect(() => {
    if (!mutation.isSuccess || !user?.id || checklistNotifiedRef.current) {
      return;
    }
    checklistNotifiedRef.current = true;
    updateChecklistTask("read_report").catch(() => {});
  }, [mutation.isSuccess, user?.id]);

  // A restored OR freshly generated report drives the finale via one shared path.
  const report = cachedReport ?? (mutation.isSuccess ? mutation.data : null);

  if (!session.persona || !session.market) {
    return (
      <p className="p-8 text-center text-on-surface-variant">
        Pick a persona and market first.
      </p>
    );
  }

  if (report) {
    // On a bare-URL entry (e.g. /tour?...&market=metro-39580) the client-side
    // market name is empty — the authed endpoint resolved it server-side for
    // the narrative, but the header prop still needs a value. Fall back to the
    // same neutral label the loading state uses so the header is never blank.
    const displayName = session.market.name || "your market";
    // The finale is persona-specific (#2): a homebuyer gets a buyer briefing and
    // an investor gets an investment briefing — never the agent listing dossier.
    const Finale =
      session.persona === "homebuyer"
        ? HomebuyerFinale
        : session.persona === "investor"
          ? InvestorFinale
          : ListingPresentation;
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
        <Finale
          report={report}
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

  // Idle (pre-fetch), pending, or restore-in-progress → loading.
  return (
    <div className="flex flex-col items-center">
      <ListingPresentationLoading
        marketName={session.market.name || "market"}
      />
      <button
        type="button"
        onClick={() => {
          // Escape hatch for a returning visitor resumed straight onto this
          // build screen (beta backlog: tour resume dead-ended on the old
          // market). Full-nav to ?resume=fresh — the same clean-state pattern
          // the error branch and the external "start over" links use: a fresh
          // mount clears persisted tour state (storage/cookie/report cache) and
          // the URL-cleanup effect drops the resumed params, landing the user
          // back on the persona cards.
          window.location.href = "/tour?resume=fresh";
        }}
        className="-mt-8 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors duration-200 hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        Start over
      </button>
    </div>
  );
}
