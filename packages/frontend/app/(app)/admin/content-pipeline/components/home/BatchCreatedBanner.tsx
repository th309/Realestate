/**
 * Batch-created confirmation. The batch-create wizard redirects to
 * `/admin/content-pipeline?batch=<id>` after submit; without this banner the
 * operator would land on the generic home with no sign their batch exists.
 * Shows what was queued and a way back to the full home (which clears the
 * `?batch=` filter — no local dismiss state needed).
 */
import Link from "next/link";

export function BatchCreatedBanner({
  batchId,
  count,
}: {
  batchId: string;
  count: number;
}) {
  const pieces =
    count > 0
      ? `${count} ${count === 1 ? "piece" : "pieces"} queued and generating`
      : "Your batch is queued";

  return (
    <section
      role="status"
      className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-primary/30 bg-primary-container/40 p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <div>
          <h2 className="font-medium text-on-surface">Batch created</h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            {pieces}. They appear below and reach the review queue as they
            finish.
          </p>
          <code className="mt-1.5 inline-block rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[11px] text-on-surface-variant">
            batch {batchId}
          </code>
        </div>
      </div>
      <Link
        href="/admin/content-pipeline"
        className="shrink-0 rounded-full border border-outline-variant bg-surface px-4 py-2 text-sm font-medium text-on-surface transition-colors duration-200 hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Show all work
      </Link>
    </section>
  );
}
