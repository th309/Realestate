"use client";

import React, { Suspense } from "react";
import { GraphsPageV2 } from "./components/GraphsPageV2";
import { GraphsPageSkeleton } from "./GraphsPageSkeleton";

export default function GraphsPageWrapper() {
  return (
    <Suspense fallback={<GraphsPageSkeleton />}>
      <GraphsPageV2 />
    </Suspense>
  );
}
