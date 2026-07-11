import Link from "next/link";
import type { MetroSlugEntry } from "@/lib/data/metro-slugs";

interface ForecastCrossLinksProps {
  metro: MetroSlugEntry;
  relatedMetros: MetroSlugEntry[];
  year: number;
}

/** Back-link to the full market page + same-state forecast pills. */
export function ForecastCrossLinks({
  metro,
  relatedMetros,
  year,
}: ForecastCrossLinksProps) {
  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href={`/markets/${metro.slug}`}
        className="inline-block rounded-xl border border-outline-variant p-5 text-on-surface hover:bg-surface-container-low"
      >
        Full {metro.shortName} market data, score history, and trends →
      </Link>
      {relatedMetros.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-medium text-on-surface mb-4">
            More {metro.state} Forecasts for {year}
          </h2>
          <div className="flex flex-wrap gap-2">
            {relatedMetros.map((m) => (
              <Link
                key={m.slug}
                href={`/forecast/${m.slug}`}
                className="rounded-full border border-outline-variant px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low"
              >
                {m.shortName}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
