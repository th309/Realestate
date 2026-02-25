import Link from 'next/link';
import { METRO_SLUG_DATA } from '@/lib/data/metro-slug-data';

function groupByState() {
  const groups: Record<string, typeof METRO_SLUG_DATA> = {};
  for (const metro of METRO_SLUG_DATA) {
    const state = metro.state || 'Other';
    if (!groups[state]) groups[state] = [];
    groups[state].push(metro);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

export default function MarketsIndexPage() {
  const stateGroups = groupByState();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-on-surface mb-2">
        US Housing Markets
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        Browse AI-powered housing market analysis for{' '}
        {METRO_SLUG_DATA.length} US metro areas. Each market page includes
        PropertyIQ scores, key metrics, and price trends.
      </p>

      {stateGroups.map(([state, metros]) => (
        <section key={state} className="mb-8">
          <h2 className="text-xl font-semibold text-on-surface mb-3 border-b border-outline-variant pb-2">
            {state}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {metros.map((metro) => (
              <Link
                key={metro.cbsaCode}
                href={`/markets/${metro.slug}`}
                className="px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors text-sm text-on-surface"
              >
                {metro.shortName}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
