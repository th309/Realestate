"use client";

interface EmptyStateCtaProps {
  onClick: () => void;
}

/**
 * Obvious, tappable "get started" card shown when no property is loaded.
 * Tapping opens the input form — the mobile sheet, or focus moves to the
 * desktop sidebar's address field. Replaces the old non-interactive prompt
 * (which pointed a "←" arrow at a sidebar hidden on mobile) plus the hidden
 * floating edit button.
 */
export function EmptyStateCta({ onClick }: EmptyStateCtaProps) {
  return (
    <button
      data-empty-cta
      type="button"
      onClick={onClick}
      className="group w-full rounded-2xl border-2 border-dashed border-primary bg-primary-container px-5 py-5 text-left text-on-primary-container transition-all hover:bg-primary-container/70 hover:shadow-md active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="flex items-center gap-4">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-primary text-2xl text-on-primary shadow-sm">
          +
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">
            Enter a property address to get started
          </span>
          <span className="mt-0.5 block text-sm text-on-primary-container/80">
            Tap to add an address and details — we&apos;ll fill in the market
            data. 2-minute analysis, zero spreadsheet.
          </span>
        </span>
        <span
          className="flex-none text-xl text-primary transition-transform group-hover:translate-x-0.5"
          aria-hidden
        >
          →
        </span>
      </span>
    </button>
  );
}
