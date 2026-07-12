import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-shaped loading state for `/map`, shown by the page's Suspense
 * boundary before `MapPageInner` (and its many hooks) mount. Mirrors
 * `MapPageInner`'s own root layout — `absolute inset-0 flex flex-col` — so
 * swapping in the real page never shifts anything, and reuses the same
 * "canvas block + legend chip" shape MapCanvas already renders for its own
 * data-loading overlay (see `MapCanvas.tsx`), so cold load and metric-switch
 * loading feel like the same system.
 *
 * No spinner: a route-shaped skeleton reads as "the app is loading" instead
 * of "waiting on a website" (task 1.2).
 */
export function MapPageSkeleton() {
  return (
    <div
      className="absolute inset-0 flex flex-col bg-surface overflow-hidden"
      role="status"
      aria-busy="true"
      aria-label="Loading map"
    >
      {/* Toolbar strip */}
      <div className="bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant px-4 py-3 z-20 shadow-sm">
        <div className="max-w-[1920px] mx-auto flex items-center gap-4">
          <Skeleton
            variant="text"
            width={64}
            height={20}
            className="hidden md:block"
          />
          <Skeleton
            variant="circular"
            width={40}
            height={40}
            className="shrink-0"
          />
          <Skeleton
            variant="rounded"
            height={40}
            className="flex-1 max-w-xl rounded-full"
          />
          <Skeleton
            variant="rounded"
            width={220}
            height={36}
            className="hidden md:block rounded-full"
          />
        </div>
      </div>

      {/* Body: sidebar rail + canvas */}
      <div className="flex-1 flex h-0 overflow-hidden">
        <div className="hidden md:flex w-[336px] shrink-0 flex-col gap-3 bg-surface-container-low rounded-r-2xl border-r border-outline-variant p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={40} />
          ))}
        </div>

        <div className="flex-1 relative bg-surface p-4 flex flex-col">
          {/* Canvas block */}
          <Skeleton variant="rounded" className="flex-1" />
          {/* Legend chip */}
          <Skeleton
            variant="rounded"
            height={40}
            width={256}
            className="mt-3"
          />
        </div>
      </div>
    </div>
  );
}

export default MapPageSkeleton;
