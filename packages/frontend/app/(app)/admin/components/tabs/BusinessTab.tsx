"use client";

import { UsersGrowthCard } from "../cards/UsersGrowthCard";
import { RevenueMrrCard } from "../cards/RevenueMrrCard";
import { FeatureUsageCard } from "../cards/FeatureUsageCard";
import { TierDistributionCard } from "../cards/TierDistributionCard";
import { FeedbackQueueCard } from "../cards/FeedbackQueueCard";

interface BusinessTabProps {
  refreshTrigger: number;
  onCardClick: (cardId: string) => void;
}

export function BusinessTab({ refreshTrigger, onCardClick }: BusinessTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div data-testid="card-users-growth">
          <UsersGrowthCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("users-growth")}
          />
        </div>
        <div data-testid="card-revenue-mrr">
          <RevenueMrrCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("revenue-mrr")}
          />
        </div>
        <div data-testid="card-feature-usage">
          <FeatureUsageCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("feature-usage")}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div data-testid="card-tier-distribution">
          <TierDistributionCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("tier-distribution")}
          />
        </div>
        <div data-testid="card-feedback-queue">
          <FeedbackQueueCard
            refreshTrigger={refreshTrigger}
            onClick={() => onCardClick("feedback-queue")}
          />
        </div>
      </div>
    </div>
  );
}
