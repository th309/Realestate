/**
 * SkeletonLoader
 *
 * Shimmer loading placeholders for card, table, and chart variants.
 * Matches M3 surface colors with pulse animation.
 */

interface SkeletonLoaderProps {
  variant: 'card' | 'table' | 'chart';
  count?: number;
}

function CardSkeleton() {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 shadow-sm">
      <div className="h-3 w-20 bg-outline-variant/30 rounded animate-pulse mb-3" />
      <div className="h-7 w-24 bg-outline-variant/30 rounded animate-pulse mb-2" />
      <div className="h-3 w-14 bg-outline-variant/30 rounded animate-pulse" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-outline-variant overflow-hidden">
      {/* Header row */}
      <div className="flex gap-4 px-4 py-3 bg-surface-container-low border-b border-outline-variant">
        {[120, 80, 60, 80].map((width, idx) => (
          <div
            key={idx}
            className="h-3 bg-outline-variant/30 rounded animate-pulse"
            style={{ width }}
          />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: 5 }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-4 px-4 py-3 border-b border-outline-variant/50 last:border-b-0"
        >
          {[120, 80, 60, 80].map((width, colIdx) => (
            <div
              key={colIdx}
              className="h-3 bg-outline-variant/20 rounded animate-pulse"
              style={{ width }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 shadow-sm">
      <div className="h-3 w-32 bg-outline-variant/30 rounded animate-pulse mb-4" />
      <div className="h-56 bg-outline-variant/15 rounded-lg animate-pulse" />
    </div>
  );
}

const VARIANT_MAP = {
  card: CardSkeleton,
  table: TableSkeleton,
  chart: ChartSkeleton,
} as const;

export function SkeletonLoader({ variant, count = 1 }: SkeletonLoaderProps) {
  const Component = VARIANT_MAP[variant];

  if (variant === 'card' && count > 1) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, idx) => (
          <Component key={idx} />
        ))}
      </div>
    );
  }

  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <Component key={idx} />
      ))}
    </>
  );
}
