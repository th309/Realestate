"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MarketRef, Persona } from "@/lib/data";
import {
  type SandboxStepId,
  nextSandboxStep,
  SANDBOX_STEP_ORDER,
} from "../step-content";
import { parseMarket } from "../lib/parseMarket";

const ACTIVE_TOUR_STORAGE_KEY = "piq.activeTour";

export interface ActiveTour {
  stepId: SandboxStepId;
  persona: Persona | null;
  market: MarketRef;
  sessionId: string;
}

export function useTourFromUrl() {
  const sp = useSearchParams();
  const router = useRouter();

  const active = useMemo<ActiveTour | null>(() => {
    const stepId = sp?.get("tour") as SandboxStepId | null;

    if (stepId && SANDBOX_STEP_ORDER.includes(stepId)) {
      const market = parseMarket(sp?.get("market") ?? null);
      const sessionId = sp?.get("sessionId") ?? null;
      if (market && sessionId) {
        const tour: ActiveTour = {
          stepId,
          persona: (sp?.get("persona") as Persona | null) ?? null,
          market,
          sessionId,
        };
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            ACTIVE_TOUR_STORAGE_KEY,
            JSON.stringify(tour),
          );
        }
        return tour;
      }
    }

    // URL has no tour params — try to rehydrate one that was interrupted.
    if (typeof window !== "undefined") {
      const raw = window.sessionStorage.getItem(ACTIVE_TOUR_STORAGE_KEY);
      if (raw) {
        try {
          const saved = JSON.parse(raw) as ActiveTour;
          if (
            saved?.stepId &&
            SANDBOX_STEP_ORDER.includes(saved.stepId) &&
            saved.market &&
            saved.sessionId
          ) {
            return saved;
          }
        } catch {
          /* ignore corrupt storage */
        }
      }
    }
    return null;
  }, [sp]);

  function buildStepUrl(target: SandboxStepId, route: string): string {
    if (!active) return route;
    const params = new URLSearchParams();
    params.set("tour", target);
    params.set("persona", active.persona ?? "agent");
    params.set("market", `${active.market.geoLevel}-${active.market.geoId}`);
    params.set("sessionId", active.sessionId);
    return `${route}?${params}`;
  }

  function advance() {
    if (!active) return;
    const next = nextSandboxStep(active.stepId);
    if (!next) return; // step2 is last → caller uses advanceToStep4
    // step2 lives on the same market page as step1.
    router.push(buildStepUrl(next, `/market/${active.market.geoId}`));
  }

  function dismiss() {
    if (typeof window !== "undefined")
      window.sessionStorage.removeItem(ACTIVE_TOUR_STORAGE_KEY);
    router.push("/dashboard"); // exit the tour INTO the app, not the marketing home
  }

  function advanceToStep4() {
    if (!active) return;
    const params = new URLSearchParams();
    params.set("persona", active.persona ?? "agent");
    params.set("market", `${active.market.geoLevel}-${active.market.geoId}`);
    params.set("sessionId", active.sessionId);
    params.set("phase", "step4");
    if (typeof window !== "undefined")
      window.sessionStorage.removeItem(ACTIVE_TOUR_STORAGE_KEY);
    router.push(`/tour?${params}`);
  }

  return { active, advance, dismiss, advanceToStep4 };
}
