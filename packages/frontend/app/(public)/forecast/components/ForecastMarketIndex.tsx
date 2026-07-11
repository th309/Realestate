import Link from "next/link";
import { METRO_SLUG_DATA } from "@/lib/data/metro-slug-data";

/** Crawlable index of every metro forecast page, grouped by state. */
export function ForecastMarketIndex({ year }: { year: number }) {
  const byState = new Map<string, typeof METRO_SLUG_DATA>();
  for (const metro of METRO_SLUG_DATA) {
    const list = byState.get(metro.state) ?? [];
    list.push(metro);
    byState.set(metro.state, list);
  }
  const states = [...byState.keys()].sort();

  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-xl font-medium text-on-surface mb-6">
        All {year} Metro Forecasts by State
      </h2>
      <div className="space-y-6">
        {states.map((state) => (
          <div key={state}>
            <h3 className="text-base font-medium text-on-surface mb-2">
              {state}
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {byState.get(state)!.map((m) => (
                <Link
                  key={m.slug}
                  href={`/forecast/${m.slug}`}
                  className="text-sm text-primary hover:underline"
                >
                  {m.shortName}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
