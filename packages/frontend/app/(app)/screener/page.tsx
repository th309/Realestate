import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenerPageInner } from "./ScreenerPageInner";

export const metadata: Metadata = {
  title: "Market Screener — PropertyIQ",
  description:
    "Screen and rank real estate markets by PropertyIQ Score, cap rate, price, months of supply, and overvaluation. Filter across 935+ metros, 3,150+ counties, and 34,000+ ZIPs.",
  alternates: { canonical: "https://www.propertyiq.app/screener" },
};

function ScreenerSkeleton() {
  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-surface-container rounded-lg" />
      <div className="h-5 w-80 bg-surface-container rounded-lg" />
      <div className="flex gap-3">
        <div className="h-10 w-64 bg-surface-container rounded-full" />
        <div className="h-10 w-40 bg-surface-container rounded-full" />
        <div className="h-10 w-40 bg-surface-container rounded-full" />
      </div>
      <div className="h-12 bg-surface-container rounded-xl" />
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant h-96" />
    </div>
  );
}

export default function ScreenerPage() {
  return (
    <Suspense fallback={<ScreenerSkeleton />}>
      <ScreenerPageInner />
    </Suspense>
  );
}
