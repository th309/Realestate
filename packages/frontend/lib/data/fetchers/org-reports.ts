/**
 * ORGANIZATION REPORT STATS FETCHER
 *
 * Fetches report usage statistics for an organization's dashboard card.
 */

import { fetchAPI } from "./base";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgReportMemberStats {
  userId: string;
  name: string;
  count: number;
}

export interface OrgReportStats {
  count: number;
  previousCount: number;
  byMember: OrgReportMemberStats[];
  limit: number;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

/**
 * Fetch report statistics for an organization (current month count,
 * previous month count, per-member breakdown, and plan limit).
 */
export async function fetchOrgReportStats(
  slug: string,
): Promise<OrgReportStats> {
  return fetchAPI<OrgReportStats>(`/api/org/${slug}/reports/stats`);
}
