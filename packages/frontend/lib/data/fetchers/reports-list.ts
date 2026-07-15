/**
 * REPORTS LIST FETCHER
 *
 * Fetches the current user's recent reports for the account page.
 * GET /api/reports/history?limit=5 — backend returns ReportSummary[] directly
 * (there is NO bare GET /api/reports route).
 */

import { fetchAPIRaw } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface ReportSummary {
  id: string;
  title: string;
  report_type: string;
  user_type: "homebuyer" | "investor" | null;
  primary_geography_name: string | null;
  status: string;
  created_at: string;
}

export async function fetchRecentReports(limit = 5): Promise<ReportSummary[]> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw(`/api/reports/history?limit=${limit}`, {
    headers: authHeaders,
  });

  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`API error: ${res.status}`);
  }

  const body = await res.json();
  // Backend returns array directly from getReportHistory
  return Array.isArray(body) ? body : (body.data ?? []);
}

export interface SaveBuilderTemplatePayload {
  title: string;
  user_type: "homebuyer" | "investor";
  sections: Record<string, unknown>[];
}

export async function saveBuilderTemplate(
  payload: SaveBuilderTemplatePayload,
): Promise<{ id: string; slug: string }> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/reports/builder-templates", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to save template: ${res.status}`);
  }
  return res.json();
}
