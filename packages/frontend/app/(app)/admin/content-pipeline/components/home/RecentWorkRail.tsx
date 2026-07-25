/**
 * Recent work rail — a quiet list of the latest runs so finished and
 * in-progress work stays one click away (this is the studio's "runs list").
 * Each tile links to its run detail and wears a plain-language StatusChip.
 */
import Link from "next/link";
import type { RunSummary } from "../../lib/content-pipeline-api";
import { FORMAT_META } from "../../lib/format-previews";
import { StatusChip } from "./StatusChip";

const MAX_VISIBLE = 8;

export function RecentWorkRail({ runs }: { runs: RunSummary[] }) {
  return (
    <section aria-labelledby="recent-work-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2
          id="recent-work-heading"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
        >
          Recent work
        </h2>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface p-6 text-sm text-on-surface-variant">
          Nothing here yet. Make your first video with the Videos card above.
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {runs.slice(0, MAX_VISIBLE).map((run) => (
            <RunTile key={run.id} run={run} />
          ))}
        </div>
      )}
    </section>
  );
}

function RunTile({ run }: { run: RunSummary }) {
  const marketLabel = run.market_query?.trim() || "Untitled run";
  const formatLabel = FORMAT_META[run.format]?.displayName ?? run.format;

  return (
    <Link
      href={`/admin/content-pipeline/runs/${run.id}`}
      className="group w-[200px] rounded-xl border border-outline-variant bg-surface-container-low p-3 shadow-sm transition-shadow duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative mb-2 flex aspect-[9/16] items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary-container to-surface-container-high">
        {run.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={run.thumbnail_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="px-2 text-center text-xs font-semibold text-on-primary-container">
            {marketLabel.split(",")[0]}
          </span>
        )}
      </div>
      <div className="truncate text-xs font-medium text-on-surface">
        {marketLabel}
      </div>
      <div className="mt-0.5 truncate text-[11px] text-on-surface-variant">
        {formatLabel}
      </div>
      <div className="mt-1.5">
        <StatusChip status={run.status} />
      </div>
    </Link>
  );
}
