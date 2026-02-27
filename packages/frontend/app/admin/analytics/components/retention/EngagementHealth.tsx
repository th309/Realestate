/**
 * EngagementHealth
 *
 * Four stat cards showing DAU, WAU, MAU, and Stickiness (DAU/MAU).
 * Displayed in a 2x2 grid above the cohort matrix.
 */

"use client";

import { Users, TrendingUp } from "lucide-react";

interface EngagementHealthProps {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
}

interface StatCardProps {
  label: string;
  value: string;
  subLabel: string;
  colorClass: string;
}

function StatCard({ label, value, subLabel, colorClass }: StatCardProps) {
  return (
    <div className="bg-surface-container rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorClass}`}
        >
          <Users className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-semibold text-on-surface mb-0.5">
        {value}
      </div>
      <div className="text-sm font-medium text-on-surface">{label}</div>
      <div className="text-xs text-on-surface-variant mt-0.5">{subLabel}</div>
    </div>
  );
}

function StickinessCard({ value }: { value: number }) {
  const pct = Math.min(100, Math.round(value * 10) / 10);
  const colorClass =
    pct >= 20
      ? "bg-green-100 text-green-700"
      : pct >= 10
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  return (
    <div className="bg-surface-container rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-purple-700" />
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}
        >
          {pct >= 20 ? "Strong" : pct >= 10 ? "Moderate" : "Weak"}
        </span>
      </div>
      <div className="text-2xl font-semibold text-on-surface mb-0.5">
        {pct}%
      </div>
      <div className="text-sm font-medium text-on-surface">Stickiness</div>
      <div className="text-xs text-on-surface-variant mt-0.5">DAU / MAU</div>
    </div>
  );
}

export function EngagementHealth({
  dau,
  wau,
  mau,
  stickiness,
}: EngagementHealthProps) {
  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  const cards: StatCardProps[] = [
    {
      label: "Daily Active Users",
      value: formatCount(dau),
      subLabel: "Unique users last 24h",
      colorClass: "bg-blue-100 text-blue-700",
    },
    {
      label: "Weekly Active Users",
      value: formatCount(wau),
      subLabel: "Unique users last 7d",
      colorClass: "bg-indigo-100 text-indigo-700",
    },
    {
      label: "Monthly Active Users",
      value: formatCount(mau),
      subLabel: "Unique users last 30d",
      colorClass: "bg-violet-100 text-violet-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
      <StickinessCard value={stickiness} />
    </div>
  );
}
