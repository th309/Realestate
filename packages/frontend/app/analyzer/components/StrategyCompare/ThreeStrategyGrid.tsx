"use client";

export interface StrategyCardData {
  id: "buyAndHold" | "flip" | "brrrr";
  title: string;
  heroMetric: { label: string; value: string };
  stats: Array<{ label: string; value: string }>;
  isWinner?: boolean;
  onClick?: () => void;
}

interface ThreeStrategyGridProps {
  strategies: StrategyCardData[];
}

export function ThreeStrategyGrid({ strategies }: ThreeStrategyGridProps) {
  return (
    <div
      data-three-strategy-grid
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      {strategies.map((s) => (
        <button
          key={s.id}
          data-strategy-card={s.id}
          onClick={s.onClick}
          className={`text-left rounded-xl border-2 p-5 bg-surface transition-shadow hover:shadow-md ${
            s.isWinner
              ? "border-[var(--md-tertiary)] shadow-md"
              : "border-outline-variant"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
              {s.title}
            </h4>
            {s.isWinner && (
              <span
                data-winner-badge
                className="text-[10px] font-bold uppercase rounded-full bg-[var(--md-tertiary)] text-[var(--md-on-tertiary)] px-2 py-0.5"
              >
                ★ Best
              </span>
            )}
          </div>
          <div className="font-mono text-3xl font-bold text-on-surface mb-1">
            {s.heroMetric.value}
          </div>
          <div className="text-xs text-on-surface-variant mb-4">
            {s.heroMetric.label}
          </div>
          <div className="space-y-1">
            {s.stats.map((stat, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-on-surface-variant">{stat.label}</span>
                <span className="font-mono text-on-surface">{stat.value}</span>
              </div>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
