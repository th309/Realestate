"use client";

import React, { Suspense } from "react";
import { MarketLanding } from "./MarketLanding";
import { MarketPageSkeleton } from "./MarketPageSkeleton";

export default function MarketPage() {
  return (
    <Suspense fallback={<MarketPageSkeleton />}>
      <MarketLanding />
    </Suspense>
  );
}
