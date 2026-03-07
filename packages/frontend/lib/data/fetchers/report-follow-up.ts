/**
 * REPORT FOLLOW-UP FETCHERS
 *
 * API functions for post-delivery report engagement:
 * threshold alerts and 30-day market change tracking.
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FollowUpAlert {
  id: string;
  report_id: string;
  metric_name: string;
  current_value: number | null;
  threshold_value: number;
  direction: "up" | "down";
  rationale: string | null;
  status: "active" | "triggered" | "dismissed";
  triggered_at: string | null;
  created_at: string;
}

export interface MarketChange {
  metric: string;
  oldValue: number;
  newValue: number;
  changePct: number;
}

export interface ReportFollowUpData {
  alerts: FollowUpAlert[];
  marketChanges: MarketChange[];
  summary?: string;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch follow-up data (alerts + market changes) for a report.
 */
export async function fetchReportFollowUp(
  reportId: string,
): Promise<ReportFollowUpData> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/reports/${reportId}/follow-up`, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch follow-up data: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Dismiss a follow-up alert.
 */
export async function dismissReportAlert(
  reportId: string,
  alertId: string,
): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(
    `${API_URL}/api/reports/${reportId}/alerts/dismiss/${alertId}`,
    {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to dismiss alert: ${response.statusText}`);
  }
}
