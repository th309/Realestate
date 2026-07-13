"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { createAlert, getMetricTitle } from "@/lib/data";
import { useEntitlements } from "@/lib/entitlements";
import { CreateAlertForm } from "./CreateAlertForm";

interface MetricAlertBellProps {
  metricId: string;
  currentValue: number | null | undefined;
  geographyType: string;
  geographyId: string;
  geographyName: string;
}

/**
 * Bell trigger on a market-detail metric card that opens CreateAlertForm
 * prefilled with the card's own metric + geography context. This is the
 * entry point the /alerts page refers to ("Use the bell icon on metric
 * cards to create alerts") — previously nothing rendered it.
 *
 * Renders nothing for non-paid tiers (same gate as the /alerts page) or when
 * the card has no numeric value to alert against.
 */
export function MetricAlertBell({
  metricId,
  currentValue,
  geographyType,
  geographyId,
  geographyName,
}: MetricAlertBellProps) {
  const { tier } = useEntitlements();
  const isPaid = tier === "pro" || tier === "enterprise" || tier === "admin";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (
    !isPaid ||
    typeof currentValue !== "number" ||
    Number.isNaN(currentValue)
  ) {
    return null;
  }

  const metricName = getMetricTitle(metricId) || metricId;

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

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label={`Set alert for ${metricName}`}
        className="flex min-w-[44px] min-h-[44px] -m-2 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors"
      >
        <Bell className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72">
          <CreateAlertForm
            metricId={metricId}
            metricName={metricName}
            currentValue={currentValue}
            geographyType={geographyType}
            geographyId={geographyId}
            geographyName={geographyName}
            onSubmit={handleSubmit}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
