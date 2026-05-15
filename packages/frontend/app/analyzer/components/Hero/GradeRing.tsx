"use client";
import { arc as d3arc } from "d3-shape";

interface GradeRingProps {
  score: number; // 0-100
  size?: number;
}

export function getLetterGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function gradeColor(score: number): string {
  if (score >= 80) return "var(--md-tertiary)";
  if (score >= 60) return "var(--md-primary)";
  if (score >= 50) return "var(--md-warning)";
  return "var(--md-error)";
}

export function GradeRing({ score, size = 160 }: GradeRingProps) {
  const radius = size / 2;
  const innerR = radius * 0.7;
  const outerR = radius * 0.95;
  const t = Math.min(1, Math.max(0, score / 100));

  const trackArc = d3arc<unknown>()
    .innerRadius(innerR)
    .outerRadius(outerR)
    .startAngle(0)
    .endAngle(Math.PI * 2)({} as any) as string;

  const valueArc = d3arc<unknown>()
    .innerRadius(innerR)
    .outerRadius(outerR)
    .startAngle(0)
    .endAngle(t * Math.PI * 2)
    .cornerRadius(4)({} as any) as string;

  const letter = getLetterGrade(score);
  const color = gradeColor(score);

  return (
    <svg
      data-grade-ring
      viewBox={`-${radius} -${radius} ${size} ${size}`}
      style={{ width: size, height: size }}
    >
      <path d={trackArc} fill="var(--md-outline-variant)" />
      <path data-grade-arc d={valueArc} fill={color} />
      <text
        x={0}
        y={-radius * 0.05}
        textAnchor="middle"
        fontSize={radius * 0.55}
        fontFamily="Roboto Mono"
        fontWeight={700}
        fill="var(--md-on-surface)"
        data-grade-letter
      >
        {letter}
      </text>
      <text
        x={0}
        y={radius * 0.32}
        textAnchor="middle"
        fontSize={radius * 0.18}
        fontFamily="Roboto Mono"
        fill="var(--md-on-surface-variant)"
        data-grade-score
      >
        {Math.round(score)}/100
      </text>
    </svg>
  );
}
