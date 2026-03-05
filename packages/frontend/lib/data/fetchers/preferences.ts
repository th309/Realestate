/**
 * PREFERENCES FETCHERS
 *
 * Functions for reading and updating user quiz preferences
 * via the NestJS PreferencesModule backend.
 *
 * GET  /api/preferences — returns { success, data: UserPreferences | null }
 * PUT  /api/preferences — accepts quiz fields, returns { success, data }
 */

import { fetchAPIRaw } from "./base";
import { getAuthHeaders } from "./auth-headers";

// ---------------------------------------------------------------------------
// Types (mirrors backend preferences.types.ts)
// ---------------------------------------------------------------------------

export type UserGoal =
  | "first_time_buyer"
  | "relocating"
  | "investor_rental"
  | "investor_flip"
  | "exploring";

export type Timeline =
  | "under_6_months"
  | "6_to_12_months"
  | "1_to_2_years"
  | "researching";

export interface UserPreferences {
  id: string;
  user_id: string;
  goal: UserGoal | null;
  priorities: string[];
  budget_min: number | null;
  budget_max: number | null;
  location_preferences: string[];
  timeline: Timeline | null;
  archetype_id: string | null;
  quiz_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertPreferencesPayload {
  goal?: UserGoal;
  priorities?: string[];
  budget_min?: number;
  budget_max?: number;
  location_preferences?: string[];
  timeline?: Timeline;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch the current user's quiz preferences.
 * Returns null when the user hasn't started the quiz yet.
 */
export async function fetchPreferences(): Promise<UserPreferences | null> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/preferences", { headers: authHeaders });

  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const body = (await res.json()) as {
    success: boolean;
    data: UserPreferences | null;
  };
  return body.data;
}

/**
 * Create or update the user's quiz preferences.
 * Returns the full saved preferences row.
 */
export async function upsertPreferences(
  payload: UpsertPreferencesPayload,
): Promise<UserPreferences> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/preferences", {
    method: "PUT",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const body = (await res.json()) as {
    success: boolean;
    data: UserPreferences;
  };
  return body.data;
}
