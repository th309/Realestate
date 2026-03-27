"use client";

interface PlaceholderCardProps {
  cardId: string;
  title: string;
  onCardClick: (cardId: string) => void;
}

function PlaceholderCard({ cardId, title, onCardClick }: PlaceholderCardProps) {
  return (
    <div
      onClick={() => onCardClick(cardId)}
      className="bg-surface-container-low border border-outline-variant rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
    >
      <h3 className="text-sm font-medium text-on-surface mb-2">{title}</h3>
      <div className="h-16 bg-surface-container rounded-lg flex items-center justify-center text-xs text-on-surface-variant">
        Card content — Plan 3
      </div>
    </div>
  );
}

interface OperationsTabProps {
  refreshTrigger: number;
  onCardClick: (cardId: string) => void;
}

export function OperationsTab({
  refreshTrigger: _refreshTrigger,
  onCardClick,
}: OperationsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <PlaceholderCard
          cardId="data-feeds"
          title="Data Feeds"
          onCardClick={onCardClick}
        />
        <PlaceholderCard
          cardId="pipeline-runs"
          title="Pipeline Runs"
          onCardClick={onCardClick}
        />
        <PlaceholderCard
          cardId="api-performance"
          title="API Performance"
          onCardClick={onCardClick}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlaceholderCard
          cardId="cache-performance"
          title="Cache Performance"
          onCardClick={onCardClick}
        />
        <PlaceholderCard
          cardId="active-alerts"
          title="Active Alerts"
          onCardClick={onCardClick}
        />
      </div>
    </div>
  );
}
