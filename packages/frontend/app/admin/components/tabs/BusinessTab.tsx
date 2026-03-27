"use client";

interface PlaceholderCardProps {
  cardId: string;
  title: string;
  onCardClick: (cardId: string) => void;
}

function PlaceholderCard({ cardId, title, onCardClick }: PlaceholderCardProps) {
  return (
    <div
      data-testid={`card-${cardId}`}
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

interface BusinessTabProps {
  refreshTrigger: number;
  onCardClick: (cardId: string) => void;
}

export function BusinessTab({
  refreshTrigger: _refreshTrigger,
  onCardClick,
}: BusinessTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <PlaceholderCard
          cardId="users-growth"
          title="Users & Growth"
          onCardClick={onCardClick}
        />
        <PlaceholderCard
          cardId="revenue-mrr"
          title="Revenue / MRR"
          onCardClick={onCardClick}
        />
        <PlaceholderCard
          cardId="feature-usage"
          title="Feature Usage"
          onCardClick={onCardClick}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlaceholderCard
          cardId="tier-distribution"
          title="Tier Distribution"
          onCardClick={onCardClick}
        />
        <PlaceholderCard
          cardId="feedback-queue"
          title="Feedback Queue"
          onCardClick={onCardClick}
        />
      </div>
    </div>
  );
}
