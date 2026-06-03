"use client";

import { useState } from "react";
import { useShadowPairs } from "@/lib/data/fetchers/ai-shadow";
import { ShadowControls } from "./components/ShadowControls";
import { ShadowPairCard } from "./components/ShadowPairCard";
import { PurposeTallySidebar } from "./components/PurposeTallySidebar";

export default function ShadowPage() {
  const [selectedPurpose, setSelectedPurpose] = useState<string | undefined>();
  const [unreviewedOnly, setUnreviewedOnly] = useState(true);

  const { data: pairs, isLoading } = useShadowPairs({
    purpose: selectedPurpose,
    unreviewedOnly,
  });

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-surface-container border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-semibold text-on-surface">
            AI Shadow Mode
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Side-by-side comparison of primary vs shadow provider on real
            production requests. Rate pairs to accumulate a directional
            preference per purpose.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <ShadowControls />

        <div className="flex items-center gap-4 text-sm text-on-surface">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={unreviewedOnly}
              onChange={(e) => setUnreviewedOnly(e.target.checked)}
              className="rounded border-outline-variant"
            />
            Unreviewed only
          </label>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          <PurposeTallySidebar
            selectedPurpose={selectedPurpose}
            onSelect={setSelectedPurpose}
          />

          <section className="space-y-4">
            {isLoading && (
              <div className="text-sm text-on-surface-variant">
                Loading pairs…
              </div>
            )}
            {!isLoading && pairs?.length === 0 && (
              <div className="rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
                No pairs match this filter. Either shadow mode is off, no
                requests have come through for this purpose, or all pairs are
                already rated.
              </div>
            )}
            {pairs?.map((pair) => (
              <ShadowPairCard key={pair.id} pair={pair} />
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
