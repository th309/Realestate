"use client";

import {
  ClipboardCheck,
  Gauge,
  Home,
  MapPin,
  Receipt,
  TrendingUp,
} from "lucide-react";

interface AnalyzerEmptyStateProps {
  /** Opens the input layer — the sheet on mobile, focus to the sidebar address field on desktop. */
  onStart: () => void;
}

/**
 * Shown in the results column before there is enough input to underwrite a
 * deal. Replaces what used to sit here: a KPI row of four em-dashes, a $0
 * projection chart with an empty axis, and a dashed "enter a property
 * address" card that duplicated the address field beside it.
 *
 * Rather than render dead instruments, this previews what each section will
 * hold — reusing the JumpBar's icon vocabulary so the empty state reads as a
 * table of contents for the page that is about to appear.
 */
const PREVIEW = [
  {
    icon: Gauge,
    title: "Cash flow",
    body: "Monthly cash flow, cash-on-cash, cap rate, and DSCR after debt service.",
  },
  {
    icon: ClipboardCheck,
    title: "Grading",
    body: "A weighted letter grade against your criteria, with the levers that move it.",
  },
  {
    icon: TrendingUp,
    title: "Projection",
    body: "Thirty years of equity, cash flow, and total return.",
  },
  {
    icon: Receipt,
    title: "Expenses",
    body: "The waterfall from gross rent down to what you actually keep.",
  },
  {
    icon: Home,
    title: "Comps",
    body: "Nearby sales and rentals, with your price per square foot in context.",
  },
  {
    icon: MapPin,
    title: "Market",
    body: "PropertyIQ Score, home values, rents, and migration for the surrounding market.",
  },
];

export function AnalyzerEmptyState({ onStart }: AnalyzerEmptyStateProps) {
  return (
    <section
      data-analyzer-empty-state
      className="rounded-xl border border-outline-variant bg-surface p-6 shadow-sm md:p-8"
    >
      <h2 className="text-xl font-semibold text-on-surface md:text-2xl">
        Underwrite a property in about two minutes
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-on-surface-variant">
        Add an address and a purchase price. We fill in taxes, rent, and market
        data where we have it, then grade the deal against your own criteria —
        no spreadsheet.
      </p>

      <button
        type="button"
        onClick={onStart}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-transform hover:shadow-md active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        Enter a property address
      </button>

      <ul className="mt-7 grid gap-x-6 gap-y-5 border-t border-outline-variant pt-6 sm:grid-cols-2">
        {PREVIEW.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex min-w-0 gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex size-8 flex-none items-center justify-center rounded-lg bg-primary-container text-on-primary-container"
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-on-surface">
                {title}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-on-surface-variant">
                {body}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
