"use client";

import { useTour } from "../TourStateProvider";
import { PersonaCard } from "./PersonaCard";

export function PersonaCards() {
  const { setPersona } = useTour();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-on-surface md:text-3xl">
          What brings you to PropertyIQ?
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Pick the closest match. Your tour is tailored to what you&apos;re
          trying to do.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PersonaCard
          persona="agent"
          icon="🏠"
          title="I'm an agent / broker"
          tag="Tools that work with your clients today"
          bullets={[
            "Branded listing presentations",
            "Side-by-side market comparisons",
            "Shareable score cards for clients",
          ]}
          priority
          onSelect={setPersona}
        />
        <PersonaCard
          persona="investor"
          icon="📈"
          title="I'm an investor"
          tag="Find your next cashflow market"
          bullets={[
            "Cashflow + appreciation analytics",
            "Deal analyzer for any address",
            "Portfolio diversification scoring",
          ]}
          onSelect={setPersona}
        />
        <PersonaCard
          persona="homebuyer"
          icon="🔑"
          title="I'm a homebuyer"
          tag="Understand a market before you buy"
          bullets={[
            "Home values + 12-month forecast",
            "Schools, cost of living, affordability",
            "Rent vs. buy break-even",
          ]}
          onSelect={setPersona}
        />
      </div>
    </div>
  );
}
