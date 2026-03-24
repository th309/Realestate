"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchEmbedMetricCard,
  getMetricTitle,
  getMetricFormat,
  formatMetricValue,
  type EmbedMetricCardData,
} from "@/lib/data";
import {
  EmbedMetricCard,
  EmbedLoadingSkeleton,
  EmbedErrorState,
} from "../../../../components";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: EmbedMetricCardData };

/**
 * Embeddable Metric Card Page
 *
 * Client component that fetches a single metric value via the embed
 * data endpoint and renders EmbedMetricCard.
 *
 * URL: /embed/metric-card/:metricId/:geoLevel/:geoId?token=emb_...
 *
 * Examples:
 *   /embed/metric-card/home_value/metro/31080?token=emb_abc123
 *   /embed/metric-card/rent_index/zip/90210?token=emb_abc123
 */
export default function EmbedMetricCardPage() {
  const params = useParams<{
    metricId: string;
    geoLevel: string;
    geoId: string;
  }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const { metricId, geoLevel, geoId } = params;

  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!metricId || !geoLevel || !geoId) {
      setState({ status: "error", message: "Missing required parameters" });
      return;
    }

    let cancelled = false;

    async function loadMetricData() {
      setState({ status: "loading" });
      try {
        const data = await fetchEmbedMetricCard(
          metricId,
          geoLevel,
          geoId,
          token,
        );
        if (!cancelled) {
          setState({ status: "success", data });
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load metric data";
          setState({ status: "error", message });
        }
      }
    }

    loadMetricData();
    return () => {
      cancelled = true;
    };
  }, [metricId, geoLevel, geoId, token]);

  if (state.status === "loading") {
    return <EmbedLoadingSkeleton />;
  }

  if (state.status === "error") {
    return <EmbedErrorState message={state.message} />;
  }

  const { data } = state;
  const format = getMetricFormat(data.metric_id);
  const formattedValue = formatMetricValue(data.value, format);
  const metricTitle = getMetricTitle(data.metric_id);

  // Derive trend direction from the numeric trend percentage
  let trend: { direction: "up" | "down" | "flat"; change: string } | undefined;
  if (data.trend !== null && data.trend !== undefined) {
    const direction: "up" | "down" | "flat" =
      data.trend > 0.05 ? "up" : data.trend < -0.05 ? "down" : "flat";
    const sign = data.trend > 0 ? "+" : "";
    trend = { direction, change: `${sign}${data.trend.toFixed(1)}%` };
  }

  return (
    <div className="flex items-center justify-center p-2">
      <EmbedMetricCard
        metricTitle={metricTitle}
        value={data.value}
        formattedValue={formattedValue}
        trend={trend}
        geoName={data.geography_name}
        periodDate={data.period_date}
      />
    </div>
  );
}
