"use client";
import { useState, ReactNode } from "react";
import { GLOSSARY, GlossaryKey } from "../../lib/glossary";

interface MetricTooltipProps {
  metric: GlossaryKey;
  children?: ReactNode; // optional override label; defaults to glossary entry name
}

export function MetricTooltip({ metric, children }: MetricTooltipProps) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY[metric];
  const label = children ?? entry?.name ?? metric;

  return (
    <span
      data-metric-tooltip
      data-metric={metric}
      className="relative inline-block cursor-help underline decoration-dotted decoration-on-surface-variant underline-offset-4"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {label}
      {open && entry && (
        <span
          role="tooltip"
          data-tooltip-body
          className="absolute z-50 left-0 top-full mt-1 w-72 rounded-xl bg-surface-container-high text-on-surface text-xs p-3 shadow-lg border border-outline-variant"
        >
          <span className="block font-semibold text-sm mb-1">{entry.name}</span>
          <span className="block font-mono text-[10px] text-on-surface-variant mb-2">
            {entry.formula}
          </span>
          <span className="block mb-1">{entry.plain}</span>
          <span className="block italic text-on-surface-variant">
            {entry.whyMatters}
          </span>
        </span>
      )}
    </span>
  );
}
