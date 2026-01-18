'use client';

import { useInView } from './hooks/useInView';

interface ScoreRingProps {
  score: number;
  label: string;
  colorClass: string; // Tailwind color class like "text-primary" or "text-tertiary"
  delay?: number;
}

export function ScoreRing({ score, label, colorClass, delay = 0 }: ScoreRingProps) {
  const [setRef, inView] = useInView();
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  // Extract the color for SVG stroke from the class
  const colorMap: Record<string, string> = {
    'text-primary': 'var(--md-primary)',
    'text-secondary': 'var(--md-secondary)',
    'text-tertiary': 'var(--md-tertiary)',
  };
  const strokeColor = colorMap[colorClass] || 'var(--md-primary)';

  return (
    <div
      ref={setRef}
      className="flex flex-col items-center gap-2 transition-all duration-500"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(20px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle
          cx="44"
          cy="44"
          r="36"
          fill="none"
          className="stroke-outline-variant"
          strokeWidth="5"
        />
        <circle
          cx="44"
          cy="44"
          r="36"
          fill="none"
          stroke={strokeColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={inView ? offset : circumference}
          transform="rotate(-90 44 44)"
          className="transition-all duration-[1500ms]"
          style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
        <text
          x="44"
          y="44"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-on-surface text-xl font-semibold"
        >
          {score}
        </text>
      </svg>
      <span className="text-xs text-on-surface-variant font-medium">{label}</span>
    </div>
  );
}
