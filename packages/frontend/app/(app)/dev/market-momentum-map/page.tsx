import { MarketMomentumMap } from "@/app/components/widgets/market-momentum-map";

export default function MarketMomentumMapDemoPage() {
  return (
    <main className="min-h-screen space-y-10 bg-surface p-8">
      <h1 className="text-2xl font-semibold text-on-surface">
        Market Momentum Map — demo
      </h1>
      <section>
        <h2 className="mb-3 text-sm text-on-surface-variant">
          size=&quot;hero&quot;
        </h2>
        <MarketMomentumMap size="hero" />
      </section>
      <section>
        <h2 className="mb-3 text-sm text-on-surface-variant">
          size=&quot;card&quot;
        </h2>
        <MarketMomentumMap size="card" />
      </section>
    </main>
  );
}
