/**
 * Cost-cap banner — surfaces when auto-ideation has hit its daily budget so
 * the operator knows why nothing new is being queued, with a route to the
 * rules. Rendered only when breached.
 */
import Link from "next/link";

export interface CostCapStatus {
  breached: boolean;
  usdSpent: number;
  usdCap: number;
}

export function CostCapBanner({ status }: { status?: CostCapStatus | null }) {
  if (!status?.breached) return null;

  return (
    <div
      role="status"
      className="flex items-start justify-between gap-4 rounded-xl border border-warning bg-warning-container/50 px-5 py-4 text-sm text-on-surface"
    >
      <div>
        <div className="font-semibold text-on-warning-container">
          Daily budget cap hit
        </div>
        <div className="mt-1 text-on-surface-variant">
          Auto-ideation is paused until tomorrow. Spent $
          {status.usdSpent.toFixed(2)} of ${status.usdCap.toFixed(2)}.
        </div>
      </div>
      <Link
        href="/admin/content-pipeline/auto-ideation"
        className="shrink-0 rounded-full bg-warning px-4 py-2 font-semibold text-on-warning transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning"
      >
        View rules
      </Link>
    </div>
  );
}
