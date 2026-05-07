/**
 * Response shape for GET /api/admin/content-pipeline/dashboard.
 *
 * Consumed by the admin dashboard page. See frontend counterpart
 * `DashboardData` in `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts`.
 */
export interface DashboardResponseDto {
  thisWeek: {
    published: number;
    inReview: number;
    signups: number;
    revenueUsd: number;
  };
  recentRuns: Array<{
    id: string;
    format: string;
    status: string;
    market_query: string;
    created_at: string;
    thumbnail_url?: string;
    views?: number;
    signups?: number;
  }>;
  reviewQueueCount: number;
  upcomingAutoRuns?: Array<{ rule_name: string; format: string; matches: any[] }>;
  costCapStatus?: { breached: boolean; usdSpent: number; usdCap: number };
}
