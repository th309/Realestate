"use client";

import Link from "next/link";

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

// A fixed launcher — the four core workflows, identical for every persona, laid
// out under the hero as two rows of two (1 / 2 / 2 with the grid below).
const LAUNCH_CARDS: Card[] = [
  {
    label: "Search the map",
    sub: "Explore any metric across the country, market by market.",
    href: "/map",
  },
  {
    label: "Screen markets",
    sub: "Rank every market by your criteria.",
    href: "/screener",
  },
  {
    label: "Analyze a deal",
    sub: "Cap rate + cashflow on any address in seconds.",
    href: "/analyzer",
  },
  {
    label: "Build a report",
    sub: "A client-ready PDF for any market.",
    href: "/reports",
  },
];

export function PersonaSpringboard() {
  const cards = [MCP_HERO, ...LAUNCH_CARDS];
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
