"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createAlert,
  formatGeoDisplayName,
  type ScreenerRow,
} from "@/lib/data";
import { useEntitlements } from "@/lib/entitlements";
import { CreateAlertForm } from "@/components/alerts/CreateAlertForm";

interface AlertMetricOption {
  id: string;
  name: string;
  value: number;
}

interface ScreenerRowAlertStepProps {
  row: ScreenerRow;
  onClose: () => void;
}

/**
 * Alert sub-step for a screener row: pick a metric, then set a threshold via
 * CreateAlertForm. Paid-only (same gate as the /alerts page + MetricAlertBell).
 */
export function ScreenerRowAlertStep({
  row,
  onClose,
}: ScreenerRowAlertStepProps) {
  const { tier } = useEntitlements();
  const isPaid = tier === "pro" || tier === "enterprise" || tier === "admin";
  const [selected, setSelected] = useState<AlertMetricOption | null>(null);

  const options: AlertMetricOption[] = [
    {
      id: "propertyiq_score",
      name: "PropertyIQ Score",
      value: row.score as number,
    },
    {
      id: "median_price",
      name: "Median Price",
      value: row.median_price as number,
    },
    { id: "cap_rate", name: "Cap Rate", value: row.cap_rate as number },
    {
      id: "months_of_supply",
      name: "Months of Supply",
      value: row.months_of_supply as number,
    },
    {
      id: "overvalued_pct",
      name: "Overvalued %",
      value: row.overvalued_pct as number,
    },
  ].filter((option) => option.value !== null && option.value !== undefined);

  if (!isPaid) {
    return (
      <div className="p-3">
        <p className="text-xs text-on-surface-variant">
          Alerts are a Pro feature.
        </p>
        <Link
          href="/pricing"
          className="mt-2 inline-flex text-xs font-medium text-primary hover:text-primary/80"
        >
          Upgrade to Pro →
        </Link>
      </div>
    );
  }

  const handleSubmit = async (data: {
    metric_id: string;
    condition: string;
    threshold: number;
    geography_type: string;
    geography_id: string;
    geography_name: string;
  }) => {
    const result = await createAlert({
      geography_type: data.geography_type,
      geography_id: data.geography_id,
      geography_name: data.geography_name,
      metric_id: data.metric_id,
      condition: data.condition as "above" | "below",
      threshold: data.threshold,
    });
    return !!result;
  };

  if (selected) {
    return (
      <CreateAlertForm
        metricId={selected.id}
        metricName={selected.name}
        currentValue={selected.value}
        geographyType={row.geo_level}
        geographyId={row.region_id}
        geographyName={formatGeoDisplayName(row.region_name)}
        onSubmit={handleSubmit}
        onClose={onClose}
        className="border-none"
      />
    );
  }

  return (
    <div className="p-3">
      <p className="mb-2 text-xs font-medium text-on-surface">
        Set an alert on…
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSelected(option)}
            className="rounded-full border border-outline-variant bg-surface-container px-2.5 py-1 text-xs text-on-surface transition-colors hover:bg-surface-container-high"
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}
