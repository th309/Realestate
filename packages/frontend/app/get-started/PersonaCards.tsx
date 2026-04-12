"use client";

import { useState } from "react";

const PERSONAS = [
  {
    value: "homebuyer",
    label: "First-time Homebuyer",
    icon: "🏠",
    searchPlaceholder: "Search for a city you'd like to live in...",
  },
  {
    value: "investor",
    label: "Real Estate Investor",
    icon: "📈",
    searchPlaceholder: "Search for your first investment market...",
  },
  {
    value: "agent",
    label: "Agent / Broker",
    icon: "🤝",
    searchPlaceholder: "Search for your farm area...",
  },
  {
    value: "researcher",
    label: "Market Researcher",
    icon: "🔍",
    searchPlaceholder: "Search for any market to analyze...",
  },
] as const;

interface PersonaCardsProps {
  onSelect: (persona: string, placeholder: string) => void;
}

export function PersonaCards({ onSelect }: PersonaCardsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-3xl font-light text-on-surface">
          What brings you here?
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          We'll tailor your experience
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
        {PERSONAS.map((p) => (
          <button
            key={p.value}
            onClick={() => {
              setSelected(p.value);
              onSelect(p.value, p.searchPlaceholder);
            }}
            className={`rounded-xl border-2 p-5 text-center transition-all duration-200 ${
              selected === p.value
                ? "border-primary bg-primary/8 scale-[1.02]"
                : "border-outline-variant bg-surface hover:border-outline hover:scale-[1.01]"
            }`}
          >
            <span className="text-3xl block" role="img" aria-label={p.label}>
              {p.icon}
            </span>
            <span className="mt-2 text-sm font-medium text-on-surface block">
              {p.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
