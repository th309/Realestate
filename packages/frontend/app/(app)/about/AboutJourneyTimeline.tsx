// packages/frontend/app/(app)/about/AboutJourneyTimeline.tsx
//
// "Our Journey" milestone list for /about. Extracted from about/page.tsx to keep
// that page under the 400-line component limit (CLAUDE.md §1.3).
//
// Every figure routes through lib/data/validation-claims.ts — coverage counts via
// COVERAGE_COPY and backtest results via V4_CLAIMS — so a re-run of the monthly
// validation can never leave this timeline asserting a stale number.
import { COVERAGE_COPY, V4_CLAIMS } from "@/lib/data/validation-claims";

interface Milestone {
  date: string;
  event: string;
}

const MILESTONES: Milestone[] = [
  {
    date: "2024",
    event:
      "PropertyIQ founded by Troy H, MBA, with a mission to democratize real estate market intelligence",
  },
  {
    date: "Early 2025",
    event:
      "First scoring formula built and validated out-of-sample on more than two decades of historical price data",
  },
  {
    date: "Mid 2025",
    event: `Out-of-sample validation completed: ${V4_CLAIMS.ic3Y} information coefficient at metro level over a 3-year horizon, positive in every validated year`,
  },
  {
    date: "Late 2025",
    event: `Platform expanded to cover ${COVERAGE_COPY.zips} ZIP codes and ${COVERAGE_COPY.counties} counties`,
  },
  {
    date: "2026",
    event:
      "Public beta launch with AI-generated market reports and interactive analytics",
  },
];

export function AboutJourneyTimeline() {
  return (
    <section className="mt-12 pt-12 border-t border-outline-variant">
      <h2 className="text-xl font-medium text-on-surface mb-6">Our Journey</h2>
      <div className="space-y-6">
        {MILESTONES.map((milestone) => (
          <div key={milestone.date} className="flex gap-6 items-start">
            <span className="text-sm font-medium text-primary whitespace-nowrap min-w-[100px]">
              {milestone.date}
            </span>
            <p className="text-on-surface-variant">{milestone.event}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
