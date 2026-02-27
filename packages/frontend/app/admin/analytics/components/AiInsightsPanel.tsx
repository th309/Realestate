"use client";

/**
 * AI Insights Panel Wrapper
 *
 * Re-exports the core insights panel from the insights/ subfolder.
 * This file exists so that page.tsx can import from `./components/AiInsightsPanel`.
 */

import { AiInsightsPanelCore } from "./insights/AiInsightsPanelCore";
import type { AnalyticsFilters } from "@/lib/data/fetchers/admin-analytics.types";

interface AiInsightsPanelProps {
  days: number;
  filters: AnalyticsFilters;
  focusArea: string;
}

export function AiInsightsPanel({
  days,
  filters,
  focusArea,
}: AiInsightsPanelProps) {
  return (
    <AiInsightsPanelCore days={days} filters={filters} focusArea={focusArea} />
  );
}
