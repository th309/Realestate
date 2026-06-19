import Link from "next/link";

/** Compact footer for all pages: E-E-A-T links + disclaimer. */
export function AppFooter() {
  return (
    <footer className="flex-shrink-0 bg-surface-container border-t border-outline-variant py-3 px-4">
      {/* Crawlable E-E-A-T links — discloses how scores are produced + sources. */}
      <nav
        aria-label="About PropertyIQ"
        className="mb-1.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
      >
        <Link
          href="/methodology"
          className="text-[11px] text-on-surface-variant transition-colors hover:text-primary"
        >
          Methodology
        </Link>
        <Link
          href="/data"
          className="text-[11px] text-on-surface-variant transition-colors hover:text-primary"
        >
          Data Sources
        </Link>
        <Link
          href="/about"
          className="text-[11px] text-on-surface-variant transition-colors hover:text-primary"
        >
          About
        </Link>
      </nav>
      <p className="text-center text-[10px] text-on-surface-variant">
        Data is provided for informational purposes only. We do not guarantee
        completeness or correctness and accept no liability for its use.
      </p>
    </footer>
  );
}
