"use client";

interface MaoScaleCardProps {
  arv: number;
  mao: number;
  asking: number;
}

const fmt = (n: number) => `$${Math.round(n / 1000)}K`;

export function MaoScaleCard({ arv, mao, asking }: MaoScaleCardProps) {
  const W = 360,
    H = 80;
  const maoX = (mao / arv) * (W - 30) + 15;
  const askX = (asking / arv) * (W - 30) + 15;
  return (
    <div
      data-mao-scale-card
      className="rounded-xl bg-surface border border-outline-variant p-4"
    >
      <div className="text-xs uppercase font-semibold mb-3 text-on-surface-variant">
        Price vs Maximum Allowable Offer
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
        <line
          x1={15}
          x2={W - 15}
          y1={H / 2}
          y2={H / 2}
          stroke="var(--md-outline-variant)"
          strokeWidth={3}
        />
        <line
          x1={maoX}
          x2={maoX}
          y1={H / 2 - 14}
          y2={H / 2 + 14}
          stroke="var(--md-tertiary)"
          strokeWidth={3}
        />
        <text
          x={maoX}
          y={H / 2 - 18}
          textAnchor="middle"
          fontSize={10}
          fontFamily="Roboto Mono"
          fill="var(--md-on-surface-variant)"
        >
          MAO {fmt(mao)}
        </text>
        <line
          x1={askX}
          x2={askX}
          y1={H / 2 - 14}
          y2={H / 2 + 14}
          stroke={asking > mao ? "var(--md-error)" : "var(--md-primary)"}
          strokeWidth={3}
        />
        <text
          x={askX}
          y={H / 2 + 28}
          textAnchor="middle"
          fontSize={10}
          fontFamily="Roboto Mono"
          fill="var(--md-on-surface-variant)"
        >
          Ask {fmt(asking)}
        </text>
        <text
          x={W - 15}
          y={H / 2 + 24}
          textAnchor="end"
          fontSize={9}
          fontFamily="Roboto"
          fill="var(--md-on-surface-variant)"
        >
          ARV {fmt(arv)}
        </text>
      </svg>
    </div>
  );
}
