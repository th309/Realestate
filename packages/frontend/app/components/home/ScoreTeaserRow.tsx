"use client";

import Link from "next/link";
import { trackEvent, flush } from "@/lib/analytics/tracker";

interface ScoreTeaserRowProps {
  rank: number;
  geoLevel: "metro" | "county" | "zip" | "state";
  geoId: string;
  name: string;
  score: number;
  hotOrCold: "hot" | "cold";
  href: string;
  label: string;
  color: string;
}

export function ScoreTeaserRow({
  rank,
  geoLevel,
  geoId,
  name,
  score,
  hotOrCold,
  href,
  label,
  color,
}: ScoreTeaserRowProps) {
  return (
    <Link
      href={href}
      onMouseDown={() => {
        trackEvent("home.score_teaser_click", {
          rank,
          geoLevel,
          geoId,
          score,
          hot_or_cold: hotOrCold,
        });
        flush();
      }}
      className="flex items-center justify-between py-2.5 border-b border-white/10 last:border-0 hover:bg-white/5 rounded px-1 -mx-1 transition-colors"
    >
      <span className="text-sm text-white font-medium truncate mr-4">
        {name}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-[#C5CAE9] uppercase tracking-wide">
          {label}
        </span>
        <span
          className="font-[family-name:var(--font-roboto-mono)] text-sm font-bold w-8 text-center rounded-md px-1.5 py-0.5"
          style={{ color, textShadow: "0 0 1px rgba(0,0,0,0.1)" }}
        >
          {score}
        </span>
      </div>
    </Link>
  );
}
