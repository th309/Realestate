/**
 * ADMIN ANALYTICS FETCHERS
 *
 * Data layer functions for the analytics dashboard.
 * All requests route through fetchAPIRaw from base, which attaches auth headers.
 */

import { fetchAPIRaw } from "./base";
import type {
  OverviewData,
  JourneyData,
  RetentionData,
  AcquisitionData,
  ConversionData,
  AnalyticsFilters,
  FunnelStep,
  Annotation,
} from "./admin-analytics.types";

function buildQueryString(days: number, filters?: AnalyticsFilters): string {
  const params = new URLSearchParams({ days: days.toString() });
  if (filters?.tier) params.set("tier", filters.tier);
  if (filters?.device) params.set("device", filters.device);
  if (filters?.source) params.set("source", filters.source);
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
  return params.toString();
}

async function fetchAnalytics<T>(
  endpoint: string,
  days: number,
  filters?: AnalyticsFilters,
): Promise<T> {
  const qs = buildQueryString(days, filters);
  const res = await fetchAPIRaw(`/api/admin/analytics/${endpoint}?${qs}`);
  if (!res.ok) throw new Error(`Analytics fetch failed: ${res.status}`);
  return res.json();
}

export function fetchOverviewAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<OverviewData> {
  return fetchAnalytics<OverviewData>("overview", days, filters);
}

export function fetchJourneyAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<JourneyData> {
  return fetchAnalytics<JourneyData>("journeys", days, filters);
}

export function fetchRetentionAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<RetentionData> {
  return fetchAnalytics<RetentionData>("retention", days, filters);
}

export function fetchAcquisitionAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<AcquisitionData> {
  return fetchAnalytics<AcquisitionData>("acquisition", days, filters);
}

export function fetchConversionAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<ConversionData> {
  return fetchAnalytics<ConversionData>("conversion", days, filters);
}

export async function exportAnalyticsCsv(
  section: string,
  days: number,
  filters?: AnalyticsFilters,
): Promise<Blob> {
  const qs = buildQueryString(days, filters) + `&section=${section}&format=csv`;
  const res = await fetchAPIRaw(`/api/admin/analytics/export?${qs}`);
  return res.blob();
}

export async function createAnnotation(
  date: string,
  label: string,
  description?: string,
): Promise<void> {
  await fetchAPIRaw("/api/admin/analytics/annotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ annotation_date: date, label, description }),
  });
}

export async function fetchAnnotations(
  startDate: string,
  endDate: string,
): Promise<Annotation[]> {
  const res = await fetchAPIRaw(
    `/api/admin/analytics/annotations?startDate=${startDate}&endDate=${endDate}`,
  );
  if (!res.ok) return [];
  return res.json();
}

export async function createFunnelDefinition(
  name: string,
  steps: { event_category: string; event_action: string }[],
): Promise<void> {
  await fetchAPIRaw("/api/admin/analytics/funnels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, steps }),
  });
}

export async function evaluateFunnel(
  funnelId: string,
  days: number,
): Promise<FunnelStep[]> {
  const res = await fetchAPIRaw(
    `/api/admin/analytics/funnels/${funnelId}?days=${days}`,
  );
  if (!res.ok) throw new Error(`Funnel eval failed: ${res.status}`);
  return res.json();
}
