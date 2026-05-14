"use client";

import type { MarketContext } from "@/lib/data";
import { formatMetricValue } from "@/lib/data";

interface Props {
  context: MarketContext | null;
  locked: boolean;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="opacity-70 text-xs uppercase">{label}</div>
      <div className="font-mono text-lg font-bold">{value}</div>
    </div>
  );
}

export default function MarketContextTile({ context, locked }: Props) {
  if (locked) {
    return (
      <div className="rounded-xl p-5 bg-gradient-to-br from-primary to-primary-container text-on-primary relative">
        <div className="absolute inset-0 backdrop-blur-sm bg-on-primary/10 rounded-xl flex items-center justify-center">
          <div className="text-center">
            <div className="mb-2">PropertyIQ Market Context</div>
            <a
              href="/pricing"
              className="px-4 py-2 rounded-full bg-on-primary text-primary text-sm"
            >
              Upgrade to see this market
            </a>
          </div>
        </div>
        <div className="opacity-40">
          <div className="text-xs mb-2">PropertyIQ Market Context</div>
          <div className="grid grid-cols-4 gap-4">
            <Stat label="PIQ" value="—" />
            <Stat label="Heat" value="—" />
            <Stat label="Rent 1Y" value="—" />
            <Stat label="Net mig." value="—" />
          </div>
        </div>
      </div>
    );
  }

  if (!context) return null;

  return (
    <div className="rounded-xl p-5 bg-gradient-to-br from-primary to-primary-container text-on-primary">
      <div className="text-xs opacity-85 mb-3">
        PropertyIQ Market Context · {context.geo_id}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {context.piq_score && (
          <Stat
            label="PIQ Score"
            value={`${context.piq_score.value} ${context.piq_score.label}`}
          />
        )}
        {context.market_heat?.value != null && (
          <Stat
            label="Heat"
            value={formatMetricValue(context.market_heat.value, "percent")}
          />
        )}
        {context.rent_index?.value != null && (
          <Stat
            label="Rent"
            value={`${formatMetricValue(context.rent_index.value, "currency")}/mo`}
          />
        )}
        {context.net_migration?.value != null && (
          <Stat
            label="Net mig."
            value={`${context.net_migration.value > 0 ? "+" : ""}${Math.round(context.net_migration.value / 1000)}K`}
          />
        )}
      </div>
    </div>
  );
}
