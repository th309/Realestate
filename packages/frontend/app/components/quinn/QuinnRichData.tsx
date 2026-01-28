'use client';

import type { QuinnStructuredData } from './QuinnStructuredData.types';
import { QuinnRankingsTable } from './QuinnRankingsTable';
import { QuinnComparisonCard } from './QuinnComparisonCard';
import { QuinnDataChart } from './QuinnDataChart';
import { QuinnTableBlock } from './QuinnTableBlock';

/**
 * Renders rich UI (table, chart, or card) from Quinn structuredData.
 * Chooses component based on what's present: rankings → table, comparison → card, chart → chart, table → table.
 */
export function QuinnRichData({ data }: { data: QuinnStructuredData }) {
  if (!data) return null;
  const { rankings, comparison, chart, table, errorMessage } = data;

  if (errorMessage && !rankings?.items?.length && !comparison?.metrics?.length && !chart?.data?.length && !table?.rows?.length) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
        {errorMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-[360px] mt-2">
      {rankings?.items?.length ? (
        <QuinnRankingsTable data={rankings} />
      ) : null}
      {comparison?.metrics?.length ? (
        <QuinnComparisonCard data={comparison} />
      ) : null}
      {chart?.data?.length ? (
        <QuinnDataChart data={chart} />
      ) : null}
      {table?.rows?.length ? (
        <QuinnTableBlock data={table} />
      ) : null}
    </div>
  );
}
