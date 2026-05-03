"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  saveOnboardingPreferences,
  saveOnboardingMarketSelection,
  startOnboardingTrial,
  updateChecklistTask,
  incrementUsageStat,
} from "@/lib/data";
import { TourStateProvider, useTour } from "./TourStateProvider";
import { PersonaCards } from "./components/PersonaCards";
import { MarketPickerStep } from "./components/MarketPickerStep";
import { Step4Aha } from "./components/Step4Aha";
import type { MarketRef, Persona } from "./types";
import "./print.css";

export default function TourPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-on-surface-variant">
          Loading tour…
        </div>
      }
    >
      <TourStateProvider>
        <TourPhaseSwitch />
      </TourStateProvider>
    </Suspense>
  );
}

function TourPhaseSwitch() {
  const { session } = useTour();
  useTourSideEffects(session.persona, session.market);

  // TODO(phase-03/04): consume `searchParams.get('next')` to drive the
  // post-tour redirect after celebrate. The legacy /get-started page used
  // `next` as the final router.push destination; here it currently rides
  // along on the URL but is not yet honored past the market step.
  switch (session.phase) {
    case "persona":
      return <PersonaCards />;
    case "market":
      return <MarketPickerStep />;
    case "step1":
      // The tour body renders on /map. Redirect there with the tour params
      // attached. The spotlight on /map reads ?tour=step1 to render itself.
      return <RedirectToStep step="step1" route="/map" />;
    case "step4":
      return <Step4Aha />;
    case "step2":
    case "step3":
      // step2/step3 spotlights mount on /map and /market pages, not /tour.
      // This placeholder is unreachable in normal navigation; kept as a
      // visible safety net if the user lands here directly via a stale URL.
      return (
        <div className="mx-auto max-w-xl px-4 py-12 text-center">
          <p className="text-sm uppercase tracking-wide text-on-surface-variant">
            Phase 04 placeholder
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-on-surface">
            Step &quot;{session.phase}&quot; lands here.
          </h1>
          <p className="mt-3 text-sm text-on-surface-variant">
            persona: {session.persona ?? "none"} · market:{" "}
            {session.market?.name ?? "none"}
          </p>
        </div>
      );
    case "celebrate":
      return (
        <div className="mx-auto max-w-xl px-4 py-12 text-center">
          <p className="text-2xl font-semibold text-on-surface">
            Phase 05 placeholder — celebrate screen lands here.
          </p>
        </div>
      );
    default:
      return <PersonaCards />;
  }
}

/**
 * Redirects from /tour to the in-app surface that renders a given tour step
 * (currently /map for step1). The /tour page is the entry point for the
 * onboarding flow; once we've collected persona + market we hand control
 * back to /map with the tour params attached so the spotlight can mount
 * over the real product surface.
 */
function RedirectToStep({ step, route }: { step: "step1"; route: string }) {
  const router = useRouter();
  const { session } = useTour();
  const { market, persona, sessionId } = session;
  useEffect(() => {
    if (!market || !persona) return;
    const params = new URLSearchParams();
    params.set("tour", step);
    params.set("persona", persona);
    params.set("market", `${market.geoLevel}-${market.geoId}`);
    params.set("sessionId", sessionId);
    router.replace(`${route}?${params}`);
  }, [router, step, route, market, persona, sessionId]);
  return (
    <div className="flex min-h-screen items-center justify-center text-on-surface-variant">
      Loading your market…
    </div>
  );
}

/**
 * Replicates the side-effects the old /get-started/page.tsx fired on
 * persona + market selection. Lives here so TourStateProvider stays pure
 * context-management, not domain logic. Each effect tracks the previous
 * value in a ref to skip re-firing on identical re-renders.
 */
function useTourSideEffects(persona: Persona | null, market: MarketRef | null) {
  const lastPersona = useRef<Persona | null>(null);
  const lastMarket = useRef<MarketRef | null>(null);

  // Persona effect: fires whenever the selected persona changes (including
  // switches between non-null values, matching legacy /get-started semantics).
  // Skips re-firing on identical re-renders.
  useEffect(() => {
    if (persona && lastPersona.current !== persona) {
      saveOnboardingPreferences({ user_type: persona }).catch((err) => {
        console.error("saveOnboardingPreferences failed", err);
      });
      lastPersona.current = persona;
    }
  }, [persona]);

  useEffect(() => {
    if (market && lastMarket.current?.geoId !== market.geoId) {
      // allSettled so a single failure doesn't break the chain; ops can
      // observe individual failures via console.error in each fetcher.
      void Promise.allSettled([
        saveOnboardingMarketSelection(market),
        startOnboardingTrial(),
        updateChecklistTask("search_market"),
        incrementUsageStat("markets_viewed"),
      ]);
      lastMarket.current = market;
    }
  }, [market]);
}
