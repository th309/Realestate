"use client";

interface Side {
  title: string;
  primary: string;
  secondary: string;
  tone: "primary" | "warn" | "ok";
}

interface ComparisonCardProps {
  left: Side;
  right: Side;
}

function toneClass(tone: Side["tone"]) {
  switch (tone) {
    case "ok":
      return "border-[var(--md-tertiary)]";
    case "warn":
      return "border-[var(--md-error)]";
    default:
      return "border-[var(--md-primary)]";
  }
}

export function ComparisonCard({ left, right }: ComparisonCardProps) {
  return (
    <div data-comparison-card className="grid grid-cols-2 gap-3">
      {[left, right].map((side, i) => (
        <div
          key={i}
          className={`rounded-xl border-2 p-4 bg-surface ${toneClass(side.tone)}`}
        >
          <div className="text-xs uppercase font-semibold mb-2 text-on-surface-variant">
            {side.title}
          </div>
          <div className="font-mono text-3xl font-bold text-on-surface">
            {side.primary}
          </div>
          <div className="text-xs text-on-surface-variant mt-1">
            {side.secondary}
          </div>
        </div>
      ))}
    </div>
  );
}
