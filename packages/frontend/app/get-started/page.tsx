"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PersonaCards } from "./PersonaCards";
import { OnboardingSearch } from "./OnboardingSearch";
import {
  saveOnboardingPreferences,
  saveOnboardingMarketSelection,
  startOnboardingTrial,
  updateChecklistTask,
  incrementUsageStat,
} from "@/lib/data";
import type { SearchResult } from "@/app/map/types";

type Phase = "persona" | "search";

export default function GetStartedPage() {
  return (
    <Suspense>
      <GetStartedContent />
    </Suspense>
  );
}

function GetStartedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");

  const [phase, setPhase] = useState<Phase>("persona");
  const [searchPlaceholder, setSearchPlaceholder] = useState(
    "Search for any market to analyze...",
  );

  function handlePersonaSelect(persona: string, placeholder: string) {
    // Fire-and-forget — don't block the UI transition
    saveOnboardingPreferences({ user_type: persona }).catch(console.error);

    setSearchPlaceholder(placeholder);
    setTimeout(() => setPhase("search"), 300);
  }

  async function handleMarketSelect(result: SearchResult) {
    const market = {
      geoLevel: result.type,
      geoId: result.id,
      name: result.name,
    };

    // Run all in parallel — none are blocking for navigation
    await Promise.allSettled([
      saveOnboardingMarketSelection(market),
      startOnboardingTrial(),
      updateChecklistTask("search_market"),
      incrementUsageStat("markets_viewed"),
    ]);

    // If the signup flow brought the user here with an intended destination, forward them
    // after onboarding completes rather than trapping them on /market/...
    if (nextPath) {
      router.push(nextPath);
    } else {
      router.push(`/market/${result.id}?type=${result.type}&onboarding=true`);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {phase === "persona" ? (
          <PersonaCards onSelect={handlePersonaSelect} />
        ) : (
          <OnboardingSearch
            placeholder={searchPlaceholder}
            onMarketSelect={handleMarketSelect}
          />
        )}
      </div>
    </div>
  );
}
