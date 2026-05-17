"use client";

import type { AdvisoryResult } from "@propertyiq/analyzer-core";

interface AdvisoriesStripProps {
  advisories: AdvisoryResult[];
}

const STATUS_COLOR: Record<AdvisoryResult["status"], string> = {
  pass: "#00C853",
  marginal: "#FFB300",
  fail: "#E53935",
};

function StatusIcon({ status }: { status: AdvisoryResult["status"] }) {
  if (status === "pass") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path
          d="M2 6.5 L5 9.5 L10 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === "marginal") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <line
          x1="2.5"
          x2="9.5"
          y1="6"
          y2="6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path
        d="M3 3 L9 9 M9 3 L3 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatAdvisoryValue(a: AdvisoryResult): string {
  switch (a.key) {
    case "one_percent_rule":
      return `${(a.value * 100).toFixed(2)}%`;
    case "grm":
      return a.value.toFixed(1);
    case "opex_ratio":
      return `${(a.value * 100).toFixed(0)}%`;
    default:
      return a.value.toFixed(2);
  }
}

export function AdvisoriesStrip({ advisories }: AdvisoriesStripProps) {
  return (
    <div data-advisories-strip className="flex flex-wrap gap-3">
      {advisories.map((a) => {
        const formatted = formatAdvisoryValue(a);
        const color = STATUS_COLOR[a.status];
        return (
          <span
            key={a.key}
            data-advisory-pill
            data-advisory-key={a.key}
            data-status={a.status}
            aria-label={`${a.label} status: ${a.status}, value: ${formatted}`}
            className="rounded-full px-3 py-1.5 text-xs flex items-center gap-1.5 bg-surface text-on-surface"
            style={{ border: `1.75px solid ${color}`, color }}
          >
            <StatusIcon status={a.status} />
            <span className="text-on-surface">
              {a.label} · {formatted}
            </span>
          </span>
        );
      })}
    </div>
  );
}
