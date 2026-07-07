"use client";

import Link from "next/link";
import type { Feature } from "@/lib/feature-coverage/feature-coverage";

/** Persona-agnostic CTA copy + deep-link for each recommendable feature. */
const COPY: Record<Feature, { title: string; sub: string; href: string }> = {
  mcp: {
    title: "Use PropertyIQ inside Claude",
    sub: "Connect once — ask about any market in plain English. Only on PropertyIQ.",
    href: "/docs/mcp",
  },
  analyzer: {
    title: "Underwrite a real deal",
    sub: "Cap rate, cashflow & CoC on any address in ~10 seconds.",
    href: "/analyzer",
  },
  screener: {
    title: "Find your next market",
    sub: "Rank every market by score, cap rate, supply — your criteria.",
    href: "/screener",
  },
  compare: {
    title: "Compare to a peer",
    sub: "See your market vs. its closest comparable, side by side.",
    href: "/market/compare",
  },
  watchlist: {
    title: "Build your watchlist",
    sub: "Track markets and get their monthly moves.",
    href: "/market",
  },
  graphs: {
    title: "Explore the data visually",
    sub: "Plot any metric across every market.",
    href: "/graphs",
  },
  report: {
    title: "Generate an AI report",
    sub: "A client-ready market brief in one click.",
    href: "/reports",
  },
  score: {
    title: "Check a market's Score",
    sub: "Your 0–100 demand signal.",
    href: "/market",
  },
};

export function NextBestActionCard({
  recommended,
  whatsNew,
}: {
  recommended: Feature | null;
  whatsNew: string | null;
}) {
  if (!recommended) return null;
  const copy = COPY[recommended];

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary-container/30 p-5">
      <div className="text-xs uppercase tracking-wide text-on-surface-variant mb-1">
        Your next best move
      </div>
      <Link href={copy.href} className="block">
        <div className="text-lg font-semibold text-on-surface">
          {copy.title}
        </div>
        <div className="text-sm text-on-surface-variant mt-0.5">{copy.sub}</div>
      </Link>
      {whatsNew && (
        <div className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant">
          <span className="inline-block h-2 w-2 rounded-full bg-tertiary" />
          <span>
            <strong>New since you left:</strong> {whatsNew}
          </span>
        </div>
      )}
    </div>
  );
}
