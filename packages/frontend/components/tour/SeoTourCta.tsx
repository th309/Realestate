"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Props {
  marketGeoId: string;
  marketGeoLevel: "metro" | "county" | "city" | "zip";
  marketName: string;
}

const STORAGE_KEY = "piq_tour_cta_dismissed";
const DISMISS_TTL_MS = 30 * 86400_000;
const APPEAR_DELAY_MS = 1500;

export function SeoTourCta({ marketGeoId, marketGeoLevel, marketName }: Props) {
  const [persona, setPersona] = useState<"agent" | "investor" | "homebuyer">(
    "agent",
  );
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed && Number(dismissed) > Date.now() - DISMISS_TTL_MS) {
      return;
    }
    const t = setTimeout(() => setHidden(false), APPEAR_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  if (hidden) return null;

  const params = new URLSearchParams({
    persona,
    market: `${marketGeoLevel}-${marketGeoId}`,
  });

  return (
    <aside
      className="fixed bottom-4 right-4 z-30 max-w-xs rounded-2xl border border-primary-container bg-surface p-4 shadow-[0_12px_32px_rgba(57,73,171,0.18)]"
      role="complementary"
      aria-label="Take a 60-second tour"
    >
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, String(Date.now()));
          setHidden(true);
        }}
        aria-label="Dismiss"
        className="absolute right-2 top-2 text-on-surface-variant/60 hover:text-on-surface-variant"
      >
        ✕
      </button>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
        60-sec tour
      </p>
      <p className="mt-1 text-sm font-semibold text-on-surface">
        See what PropertyIQ shows you about {marketName}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["agent", "investor", "homebuyer"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPersona(p)}
            className={[
              "rounded-full border px-2.5 py-1 text-[11px] font-medium",
              persona === p
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant text-on-surface-variant",
            ].join(" ")}
          >
            {p === "agent"
              ? "Agent"
              : p === "investor"
                ? "Investor"
                : "Homebuyer"}
          </button>
        ))}
      </div>
      <Link
        href={`/tour?${params}`}
        className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-on-primary"
      >
        Start the tour →
      </Link>
    </aside>
  );
}
