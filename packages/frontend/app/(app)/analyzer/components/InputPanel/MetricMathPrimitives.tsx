"use client";

/**
 * Layout primitives for the metric-math waterfall. MathSection wraps a group
 * of Row / Total lines with a small uppercase heading; Row is a label/value
 * pair styled as the running operands; Total bolds the resulting line.
 *
 * fmt* helpers live here so all strategy panels render dollars / percents
 * the same way.
 */

import type { ReactNode } from "react";

export const fmtUsd = (n: number) => {
  const abs = Math.abs(Math.round(n));
  const formatted = abs.toLocaleString();
  return n < 0 ? `−$${formatted}` : `$${formatted}`;
};

export const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

export const fmtRatio = (n: number) => n.toFixed(2);

export function MathSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-outline-variant/60 bg-surface-container-low/40 p-2.5">
      <div
        className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-1.5"
        style={{ fontFamily: "var(--font-roboto)" }}
      >
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function Row({
  label,
  value,
  indent,
}: {
  label: string;
  value: string;
  indent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 text-on-surface-variant">
      <span
        className={indent ? "pl-4" : ""}
        style={{ fontFamily: "var(--font-roboto)" }}
      >
        {label}
      </span>
      <span className="tabular-nums shrink-0">{value}</span>
    </div>
  );
}

export function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-on-surface font-semibold">
      <span style={{ fontFamily: "var(--font-roboto)" }}>{label}</span>
      <span className="tabular-nums shrink-0">{value}</span>
    </div>
  );
}
