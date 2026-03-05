/**
 * REPORTS LIST FETCHER
 *
 * Fetches the current user's recent reports for the account page.
 * GET /api/reports?limit=5 — returns { success, data: ReportSummary[] }
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
  const res = await fetchAPIRaw(`/api/reports?limit=${limit}`, {
    headers: authHeaders,
  });

  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`API error: ${res.status}`);
  }

  const body = (await res.json()) as {
    success: boolean;
    data: ReportSummary[];
  };
  return body.data ?? [];
}
