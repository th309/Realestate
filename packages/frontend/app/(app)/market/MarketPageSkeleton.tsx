import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-shaped loading state for `/market`, shown by the page's Suspense
 * boundary before `MarketLanding` mounts. Mirrors `MarketLanding`'s own
 * outer wrapper (`min-h-screen` → `min-h-dvh`, same max-width + padding) and
 * its header row + card grid sections, so the swap to real content doesn't
 * jump. No spinner (task 1.2).
 */
export function MarketPageSkeleton() {
  return (
    <div
      className="min-h-dvh bg-surface"
      role="status"
      aria-busy="true"
      aria-label="Loading markets"
    >
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* Header row */}
        <div className="mb-8 flex items-center gap-3">
          <Skeleton variant="rounded" width={40} height={40} />
          <div className="space-y-2">
            <Skeleton variant="text" height={24} width={200} />
            <Skeleton variant="text" height={14} width={320} />
          </div>
        </div>

        {/* Search section */}
        <Skeleton variant="rounded" height={180} className="mb-8 rounded-3xl" />

        {/* Card grid (Recently Viewed / Popular Markets shape) */}
        <div className="mb-8">
          <Skeleton variant="text" height={20} width={160} className="mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={68} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarketPageSkeleton;
