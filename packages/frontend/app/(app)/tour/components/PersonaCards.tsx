"use client";

import { useTour } from "../TourStateProvider";
import { PersonaCard } from "./PersonaCard";

export function PersonaCards() {
  const { setPersona } = useTour();
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <header className="mb-5 text-center md:mb-8">
        <h1 className="text-xl font-semibold text-on-surface sm:text-2xl md:text-3xl">
          What brings you to PropertyIQ?
        </h1>
        <p className="mt-1.5 text-sm text-on-surface-variant md:mt-2">
          Pick the one that fits you best. Your tour is tailored to it.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
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
