"use client";

interface RefreshAllInsightsProps {
  staleRefreshers: Array<{ id: string; refresh: () => void }>;
}

export function RefreshAllInsights({
  staleRefreshers,
}: RefreshAllInsightsProps) {
  const count = staleRefreshers.length;
  const handleClick = () => {
    staleRefreshers.forEach((s) => s.refresh());
  };
  return (
    <button
      data-refresh-all-insights
      data-stale-count={count}
      onClick={handleClick}
      disabled={count === 0}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        count > 0
          ? "bg-primary text-on-primary hover:bg-primary-dark"
          : "bg-surface-container-low text-on-surface-variant cursor-not-allowed"
      }`}
    >
      <span aria-hidden>↻</span>
      {count > 0
        ? `Refresh ${count} stale insight${count > 1 ? "s" : ""}`
        : "All insights fresh"}
    </button>
  );
}
