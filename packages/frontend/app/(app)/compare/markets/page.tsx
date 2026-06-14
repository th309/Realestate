"use client";

import { Suspense } from "react";
import { MarketComparisonView } from "./MarketComparisonView";

export default function CompareMarketsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-on-surface-variant">
          Loading comparison…
        </div>
      }
    >
      <MarketComparisonView />
    </Suspense>
  );
}
