/**
 * WATCHLIST DATA FETCHERS
 *
 * API functions for managing the user's geography watchlist.
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WatchlistItem {
  id: string;
  geography_type: string;
  geography_id: string;
  geography_name: string;
  tags?: string[];
  folder?: string;
  added_at: string;
  score_at_add?: number;
}

export interface AddToWatchlistDto {
  geography_type: string;
  geography_id: string;
  geography_name?: string;
  tags?: string[];
  folder?: string;
  score_at_add?: number;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch all watchlist items for the current user.
 * Returns an empty array if the user is not authenticated.
 */
export async function fetchWatchlist(): Promise<WatchlistItem[]> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/analytics/watchlist`, {
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 401) return [];

  if (!response.ok) {
    throw new Error(`Failed to fetch watchlist: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data ?? [];
}

/**
 * Add a geography to the user's watchlist.
 */
export async function addToWatchlist(
  dto: AddToWatchlistDto,
): Promise<WatchlistItem> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/analytics/watchlist`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to add to watchlist: ${response.status}`,
    );
  }

  return response.json();
}

/**
 * Remove a geography from the user's watchlist.
 */
export async function removeFromWatchlist(
  geographyType: string,
  geographyId: string,
): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(
    `${API_URL}/api/analytics/watchlist/geography/${encodeURIComponent(geographyType)}/${encodeURIComponent(geographyId)}`,
    {
      method: "DELETE",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to remove from watchlist: ${response.status}`,
    );
  }
}
