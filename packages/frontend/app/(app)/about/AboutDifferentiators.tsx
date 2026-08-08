// packages/frontend/app/(app)/about/AboutDifferentiators.tsx
//
// "What Makes PropertyIQ Different" card grid for /about. Extracted from
// about/page.tsx to keep that page under the 400-line component limit
// (CLAUDE.md §1.3).
//
// Coverage copy comes from COVERAGE_COPY — never a hardcoded market count.
import Link from "next/link";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";

export function AboutDifferentiators() {
  return (
    <section className="mt-12 pt-12 border-t border-outline-variant">
      <h2 className="text-xl font-medium text-on-surface mb-6">
        What Makes PropertyIQ Different
      </h2>
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-surface-container-low">
          <h3 className="font-medium text-on-surface mb-2">
            Predictive, Not Just Descriptive
          </h3>
          <p className="text-sm text-on-surface-variant">
            Most real estate platforms show you what happened. PropertyIQ
            predicts what will happen, using a transparent, validated scoring
            formula tested against actual market outcomes.
          </p>
        </div>
        <div className="p-6 rounded-xl bg-surface-container-low">
          <h3 className="font-medium text-on-surface mb-2">
            Validated with Real Data
          </h3>
          <p className="text-sm text-on-surface-variant">
            The PropertyIQ Score is validated against actual market outcomes
            across more than two decades, and was positive in every validated
            year. We publish our accuracy metrics openly — something most
            competitors don&apos;t do.
          </p>
          <Link
            href="/scores/methodology"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            See how scores are validated →
          </Link>
        </div>
        <div className="p-6 rounded-xl bg-surface-container-low">
          <h3 className="font-medium text-on-surface mb-2">
            Comprehensive Coverage
          </h3>
          <p className="text-sm text-on-surface-variant">
            {COVERAGE_COPY.metros} metros, {COVERAGE_COPY.counties} counties,{" "}
            {COVERAGE_COPY.zips} ZIP codes. From major cities to small towns,
            PropertyIQ covers every corner of the US housing market.
          </p>
        </div>
        <div className="p-6 rounded-xl bg-surface-container-low">
          <h3 className="font-medium text-on-surface mb-2">
            Transparent Methodology
          </h3>
          <p className="text-sm text-on-surface-variant">
            We publish our full methodology, validation results, and data
            sources. You can see exactly how scores are calculated and verified.
          </p>
          <Link
            href="/scores/methodology"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Read the full methodology →
          </Link>
        </div>
      </div>
    </section>
  );
}
