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
import { PostSignupCelebrate } from "./components/PostSignupCelebrate";
import type { MarketRef, Persona, TourPhase } from "./types";
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

  // Self-heal orphan states so the user is NEVER stranded on a frozen
  // "Loading your market…" screen (spec §5.2: never dead-end the tour). The
  // step phases redirect into the product on a chosen market; reaching one
  // without a market — a stale URL/localStorage, a refresh mid-flow, or a
  // hand-edited link — falls back to collecting what's missing instead of
  // hanging. Computed at render only (no state mutation), so it's idempotent:
  // once the user picks a market, setMarket re-enters step1 with it.
  const STEP_PHASES: TourPhase[] = ["step1", "step2", "step3", "step4"];
  const phase: TourPhase =
    STEP_PHASES.includes(session.phase) && !session.market
      ? session.persona
        ? "market"
        : "persona"
      : session.phase;

  // `?next=` (return-to-context) rides along on the URL through the flow and is
  // consumed at the `celebrate` phase: PostSignupCelebrate routes the primary
  // CTA to a safe same-origin `next` when present (falls back to the dashboard).
  switch (phase) {
    case "persona":
      return <PersonaCards />;
    case "market":
      return <MarketPickerStep />;
    case "step1":
      // The tour body now renders on the market-detail page: step1 (the score)
      // and step2 (the AI assessment) both live on /market/<geoId>. Redirect
      // there with the tour params so the spotlight can mount over the score.
      return (
        <RedirectToStep
          step="step1"
          route={`/market/${session.market?.geoId ?? ""}`}
        />
      );
    case "step4":
      return <Step4Aha />;
    case "step2":
    case "step3":
      // The value-arc spotlights (step1 + step2) mount on the market-detail
      // page, not /tour; step3 is a vestigial phase. This placeholder is
      // unreachable in normal navigation; kept as a visible safety net if the
      // user lands here directly via a stale URL.
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
      return <PostSignupCelebrate />;
    default:
      return <PersonaCards />;
  }
}

/**
 * Redirects from /tour to the in-app surface that renders a given tour step
 * (the market-detail page /market/<geoId> for step1). The /tour page is the
 * entry point for the onboarding flow; once we've collected persona + market
 * we hand control back to the market page with the tour params attached so the
 * spotlight can mount over the real product surface.
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
    // Two params carry the geography on purpose, do NOT drop either:
    //   `type`   — the market page (/market/[id]) reads this for its data fetch;
    //              without it geographyType defaults to "metro", so a zip/county
    //              pick loads an empty "Metro <id>" dashboard.
    //   `market` — the tour spotlight (useTourFromUrl) parses "<geoLevel>-<geoId>"
    //              to know which market the coach-marks belong to.
    params.set("type", market.geoLevel);
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
