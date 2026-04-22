import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface ScoreRingProps {
  score: number;
  size: number;
}

/**
 * Shared animated score ring used by BrandOutroCard and any future
 * score-forward layouts. Extracted from the legacy ScoreReveal scene
 * so the primitive can be re-used without pulling in scene styles.
 */
export const ScoreRing: React.FC<ScoreRingProps> = ({ score, size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 20 } });
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress * (score / 100));
  const color =
    score >= 80
      ? "#00C853"
      : score >= 60
        ? "#3949AB"
        : score >= 40
          ? "#FF8F00"
          : "#B3261E";

  return (
    <svg width={size} height={size}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#C5CAE9"
        strokeWidth={8}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={8}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dy="0.35em"
        textAnchor="middle"
        fontFamily="Roboto Mono"
        fontWeight={700}
        fontSize={size * 0.36}
        fill={color}
      >
        {Math.round(score * progress)}
      </text>
    </svg>
  );
};
