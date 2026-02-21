/**
 * REPORT DATA FETCHERS
 *
 * API functions for report-specific operations.
 */

import { API_URL } from './base';
import { getAuthHeaders } from './auth-headers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegenerateNarrativesRequest {
  user_inputs: Record<string, unknown>;
}

interface RegenerateNarrativesResponse {
  updated_keys: string[];
  ai_narrative: Record<string, string | string[]>;
}

export interface GenerateReportRequest {
  template_slug: string;
  user_type: string;
  primary_geography: {
    id: string;
    type: string;
    name: string;
    state?: string;
    center?: [number, number];
  };
  comparison_geographies?: {
    id: string;
    type: string;
    name: string;
    state?: string;
    center?: [number, number];
  }[];
  user_inputs?: Record<string, unknown>;
}

export interface GenerateReportResponse {
  report_id: string;
  status: 'generating';
}

interface FetchReportOptions {
  userId: string;
}

interface GenerateReportOptions {
  userId: string;
  userTier?: string;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch a single report by ID.
 */
export async function fetchReport<T = unknown>(
  reportId: string,
  options: FetchReportOptions,
): Promise<T | null> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/reports/${reportId}`, {
    headers: {
      ...authHeaders,
      'x-user-id': options.userId,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch report: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch report history for the current user.
 */
export async function fetchReportHistory<T = unknown>(
  options: FetchReportOptions,
): Promise<T[]> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/reports/history`, {
    headers: {
      ...authHeaders,
      'x-user-id': options.userId,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch reports');
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch a paginated report list.
 */
export async function fetchReportList<T = unknown>(
  options: FetchReportOptions & { limit?: number },
): Promise<T[]> {
  const authHeaders = await getAuthHeaders();
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));

  const response = await fetch(`${API_URL}/api/reports?${params}`, {
    headers: { ...authHeaders, 'x-user-id': options.userId },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch reports');
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Generate a new report.
 */
export async function generateReport(
  body: GenerateReportRequest,
  options: GenerateReportOptions,
): Promise<GenerateReportResponse> {
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    'Content-Type': 'application/json',
    'x-user-id': options.userId,
  };
  if (options.userTier) {
    headers['x-user-tier'] = options.userTier;
  }

  const response = await fetch(`${API_URL}/api/reports/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to generate report: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch a shared report by its public share token (no auth required).
 */
export async function fetchSharedReport<T = unknown>(
  token: string,
): Promise<T | null> {
  const response = await fetch(`${API_URL}/api/reports/shared/${encodeURIComponent(token)}`);

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Shared report not found or expired`);
  }

  return response.json();
}

/**
 * Create a share link for a report. Returns the share token.
 */
export async function createReportShareLink(
  reportId: string,
  userId: string,
  options?: { accessLevel?: 'view' | 'download'; expiresInDays?: number },
): Promise<string> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/reports/${reportId}/share`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify({
      access_level: options?.accessLevel || 'view',
      expires_in_days: options?.expiresInDays,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create share link: ${response.statusText}`);
  }

  const data = await response.json();
  return data.share_token;
}

/**
 * Request narrative regeneration for a report based on updated user inputs.
 */
export async function regenerateNarratives(
  reportId: string,
  userInputs: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<RegenerateNarrativesResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/reports/${reportId}/regenerate-narratives`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_inputs: userInputs } satisfies RegenerateNarrativesRequest),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to regenerate narratives: ${response.status}`);
  }

  return response.json();
}
