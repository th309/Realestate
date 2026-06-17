"use client";

import Link from "next/link";
import type { Persona, MarketRef } from "@/lib/data";

interface Card {
  label: string;
  sub: string;
  href: string;
  hero?: boolean;
}

const MCP_HERO: Card = {
  label: "⚡ Connect Claude",
  sub: "Only on PropertyIQ — query your markets in plain English from inside Claude.",
  href: "/docs/mcp",
  hero: true,
};

function personaCards(persona: Persona | null, market: MarketRef): Card[] {
  const cmp: Card = {
    label: "Compare markets",
    sub: `${market.name} vs. its closest peer, side by side.`,
    href: "/compare/markets",
  };
  const analyze: Card = {
    label: "Analyze a deal",
    sub: "Cap rate + cashflow on any address in seconds.",
    href: "/analyzer",
  };
  const screen: Card = {
    label: "Screen markets",
    sub: "Rank every market by your criteria.",
    href: "/screener",
  };
  switch (persona) {
    case "agent":
      return [
        cmp,
        screen,
        {
          label: "Build a report",
          sub: "A client-ready PDF for any market.",
          href: "/reports",
        },
      ];
    case "homebuyer":
      return [analyze, cmp, screen];
    case "investor":
    default:
      return [analyze, screen, cmp];
  }
}

export function PersonaSpringboard({
  persona,
  market,
}: {
  persona: Persona | null;
  market: MarketRef;
}) {
  const cards = [MCP_HERO, ...personaCards(persona, market)];
  return (
    <section
      data-testid="persona-springboard"
      className="mt-8"
      data-print-hide="true"
    >
      <h3 className="text-sm font-medium uppercase tracking-wide text-on-surface-variant mb-3">
        Now put it to work
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c) => (
          <Link
            key={c.href + c.label}
            href={c.href}
            className={[
              "block rounded-xl border p-4 transition-colors",
              c.hero
                ? "border-primary/50 bg-primary-container/40 hover:bg-primary-container/60 sm:col-span-2"
                : "border-outline-variant/40 bg-surface-container hover:bg-surface-container-high",
            ].join(" ")}
          >
            <div className="font-medium text-on-surface">{c.label}</div>
            <div className="text-sm text-on-surface-variant mt-0.5">
              {c.sub}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
