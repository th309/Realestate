import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-shaped loading state for `/graphs`, shown by the page's Suspense
 * boundary before `GraphsPageV2` mounts. Mirrors `GraphsPageV2`'s own root
 * (`h-[calc(100dvh-64px)] flex flex-col`, same header + sidebar + chart-area
 * regions) so the swap to real content never jumps. No spinner (task 1.2).
 */
export function GraphsPageSkeleton() {
  return (
    <div
      className="h-[calc(100dvh-64px)] bg-surface flex flex-col overflow-hidden"
      role="status"
      aria-busy="true"
      aria-label="Loading Market Explorer"
    >
      {/* Compact header */}
      <div className="flex-shrink-0 bg-surface-container-lowest border-b border-outline-variant/40 px-4 md:px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center gap-3">
          <Skeleton
            variant="rounded"
            height={40}
            className="flex-1 max-w-md rounded-full"
          />
          <Skeleton
            variant="rounded"
            width={90}
            height={36}
            className="ml-auto rounded-full"
          />
        </div>
      </div>

      {/* Sidebar + chart area */}
      <div className="flex-1 flex min-h-0 max-w-[1600px] mx-auto w-full px-4 md:px-5 py-3 gap-4 overflow-hidden">
        <div className="hidden md:flex w-64 shrink-0 flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={36} />
          ))}
        </div>

        <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">
          <Skeleton variant="rounded" className="flex-1 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

export default GraphsPageSkeleton;
