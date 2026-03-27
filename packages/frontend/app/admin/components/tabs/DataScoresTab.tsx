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

interface DataScoresTabProps {
  refreshTrigger: number;
  onCardClick: (cardId: string) => void;
}

export function DataScoresTab({
  refreshTrigger: _refreshTrigger,
  onCardClick,
}: DataScoresTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <PlaceholderCard
          cardId="score-health"
          title="Score Health"
          onCardClick={onCardClick}
        />
        <PlaceholderCard
          cardId="ml-ops"
          title="ML Ops"
          onCardClick={onCardClick}
        />
        <PlaceholderCard
          cardId="geographic-coverage"
          title="Geographic Coverage"
          onCardClick={onCardClick}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlaceholderCard
          cardId="data-quality"
          title="Data Quality"
          onCardClick={onCardClick}
        />
        <PlaceholderCard
          cardId="score-computation"
          title="Score Computation"
          onCardClick={onCardClick}
        />
      </div>
    </div>
  );
}
