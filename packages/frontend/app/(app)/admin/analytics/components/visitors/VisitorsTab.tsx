/**
 * VisitorsTab
 *
 * Master/detail explorer for individual visitors.
 *
 * On large screens both panes are visible at once. On small screens they take
 * turns: the list until something is selected, then the journey with a way
 * back — a 26rem list and a timeline cannot share a phone width legibly.
 *
 * Data comes from useVisitorList / useVisitorTimeline in @/lib/data. The
 * traffic segment travels in `filters`, so this tab describes the same
 * population as every other tab on the page.
 */

"use client";

import { useMemo, useState } from "react";
import { useVisitorList } from "@/lib/data";
import type {
  AnalyticsFilters,
  Annotation,
} from "@/lib/data/fetchers/admin-analytics.types";
import { VisitorList } from "./VisitorList";
import { VisitorJourneyPanel } from "./VisitorJourneyPanel";

const VISITOR_PAGE_SIZE = 100;

interface VisitorsTabProps {
  days: number;
  filters: AnalyticsFilters;
  compare: boolean;
  onDrillDown: (key: string, value: string) => void;
  annotations?: Annotation[];
}

export function VisitorsTab({ days, filters }: VisitorsTabProps) {
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(
    null,
  );
  const [onlyConverted, setOnlyConverted] = useState(false);

  const listOptions = useMemo(
    () => ({ converted: onlyConverted, limit: VISITOR_PAGE_SIZE }),
    [onlyConverted],
  );

  const { data, isLoading, isError, error } = useVisitorList(
    days,
    filters,
    listOptions,
  );

  const visitors = useMemo(() => data?.visitors ?? [], [data]);

  // Resolved from the list rather than held in state, so a refetch or a filter
  // change cannot leave the detail pane showing a visitor the list no longer
  // contains — the selection would silently describe the wrong window.
  const selectedVisitor = useMemo(
    () => visitors.find((v) => v.visitorId === selectedVisitorId) ?? null,
    [visitors, selectedVisitorId],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
      <div className={selectedVisitor ? "hidden lg:block" : "block"}>
        <VisitorList
          visitors={visitors}
          selectedVisitorId={selectedVisitorId}
          onSelect={setSelectedVisitorId}
          isLoading={isLoading}
          isError={isError}
          errorMessage={error instanceof Error ? error.message : undefined}
          truncated={data?.truncated ?? false}
          limit={data?.limit ?? VISITOR_PAGE_SIZE}
          onlyConverted={onlyConverted}
          onOnlyConvertedChange={(value) => {
            setOnlyConverted(value);
            setSelectedVisitorId(null);
          }}
        />
      </div>

      <div className={selectedVisitor ? "block" : "hidden lg:block"}>
        <VisitorJourneyPanel
          visitor={selectedVisitor}
          onBack={() => setSelectedVisitorId(null)}
        />
      </div>
    </div>
  );
}
