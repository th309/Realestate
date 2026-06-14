"use client";

import { DataFeedsCard } from "../cards/DataFeedsCard";
import { PipelineRunsCard } from "../cards/PipelineRunsCard";
import { ApiPerformanceCard } from "../cards/ApiPerformanceCard";
import { CachePerformanceCard } from "../cards/CachePerformanceCard";
import { ActiveAlertsCard } from "../cards/ActiveAlertsCard";

interface OperationsTabProps {
  refreshTrigger: number;
  onCardClick: (cardId: string) => void;
}

export function OperationsTab({
  refreshTrigger,
  onCardClick,
}: OperationsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div data-testid="card-data-feeds">
          <DataFeedsCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("data-feeds")}
          />
        </div>
        <div data-testid="card-pipeline-runs">
          <PipelineRunsCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("pipeline-runs")}
          />
        </div>
        <div data-testid="card-api-performance">
          <ApiPerformanceCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("api-performance")}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div data-testid="card-cache-performance">
          <CachePerformanceCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("cache-performance")}
          />
        </div>
        <div data-testid="card-active-alerts">
          <ActiveAlertsCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("active-alerts")}
          />
        </div>
      </div>
    </div>
  );
}
