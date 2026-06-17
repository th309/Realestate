"use client";

import { useEffect, useState } from "react";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";

interface Props {
  score: number;
  /** Diameter in px. */
  size?: number;
  className?: string;
}

/**
 * The hero PropertyIQ Score gauge. An SVG ring that animates its arc on mount
 * (a single emphasized-decelerate sweep — the "reveal" moment), honoring
 * prefers-reduced-motion. Arc color comes from the central getScoreColor
 * utility (CLAUDE.md §9), so 19 reads red, 80+ reads green.
 */
export function ScoreGauge({ score, size = 168, className }: Props) {
  const stroke = Math.max(8, Math.round(size * 0.085));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = getScoreColor(score);

  const [drawn, setDrawn] = useState(false);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(m.matches);
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const offset = drawn || reduce ? circumference * (1 - pct) : circumference;

  return (
    <div
      className={`relative inline-grid place-items-center ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--md-outline-variant)"
          strokeOpacity={0.35}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: reduce
              ? "none"
              : "stroke-dashoffset 1100ms cubic-bezier(0.05, 0.7, 0.1, 1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex items-baseline">
          <span
            className="font-mono font-semibold text-on-surface"
            style={{ fontSize: size * 0.36, lineHeight: 1 }}
          >
            {score}
          </span>
          <span
            className="font-mono text-on-surface-variant"
            style={{ fontSize: size * 0.1 }}
          >
            /100
          </span>
        </div>
      </div>
    </div>
  );
}
