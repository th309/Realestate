"use client";

import { ScoreHealthCard } from "../cards/ScoreHealthCard";
import { MlOpsCard } from "../cards/MlOpsCard";
import { GeographicCoverageCard } from "../cards/GeographicCoverageCard";
import { DataQualityCard } from "../cards/DataQualityCard";
import { ScoreComputationCard } from "../cards/ScoreComputationCard";

interface DataScoresTabProps {
  refreshTrigger: number;
  onCardClick: (cardId: string) => void;
}

export function DataScoresTab({
  refreshTrigger,
  onCardClick,
}: DataScoresTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div data-testid="card-score-health">
          <ScoreHealthCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("score-health")}
          />
        </div>
        <div data-testid="card-ml-ops">
          <MlOpsCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("ml-ops")}
          />
        </div>
        <div data-testid="card-geographic-coverage">
          <GeographicCoverageCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("geographic-coverage")}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div data-testid="card-data-quality">
          <DataQualityCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("data-quality")}
          />
        </div>
        <div data-testid="card-score-computation">
          <ScoreComputationCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("score-computation")}
          />
        </div>
      </div>
    </div>
  );
}
