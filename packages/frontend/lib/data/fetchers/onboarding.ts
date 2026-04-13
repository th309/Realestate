/**
 * ONBOARDING FETCHERS
 *
 * Functions for reading and updating onboarding state and user preferences
 * stored in the user_profiles table.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { API_URL } from "./base";

export interface OnboardingState {
  onboarding_completed_at: string | null;
  user_type: string | null;
  investment_goal: string | null;
  experience_level: string | null;
  preferred_markets: Array<{
    geoLevel: string;
    geoId: string;
    name: string;
  }> | null;
  onboarding_market: {
    geoLevel: string;
    geoId: string;
    name: string;
  } | null;
  onboarding_checklist: string[];
  dismissed_beacons: string[];
  usage_stats: {
    markets_viewed: number;
    scores_checked: number;
    reports_generated: number;
  } | null;
  free_report_credits: number;
}

export async function fetchOnboardingState(): Promise<OnboardingState | null> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "onboarding_completed_at, user_type, investment_goal, experience_level, preferred_markets, onboarding_market, onboarding_checklist, dismissed_beacons, usage_stats, free_report_credits",
    )
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return data as OnboardingState;
}

export async function completeOnboarding(): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("user_profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);
}

export async function resetOnboarding(): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("user_profiles")
    .update({ onboarding_completed_at: null })
    .eq("id", user.id);
}

export async function saveOnboardingPreferences(
  preferences: Partial<
    Pick<
      OnboardingState,
      "user_type" | "investment_goal" | "experience_level" | "preferred_markets"
    >
  >,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("user_profiles").update(preferences).eq("id", user.id);
}

export async function startOnboardingTrial(): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await fetch(`${API_URL}/api/onboarding/start-trial`, {
    method: "POST",
    headers: { "x-user-id": user.id },
  });
}

export async function saveOnboardingMarketSelection(market: {
  geoLevel: string;
  geoId: string;
  name: string;
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await fetch(`${API_URL}/api/onboarding/save-market`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.id,
    },
    body: JSON.stringify(market),
  });
}

export async function updateChecklistTask(taskId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await fetch(`${API_URL}/api/onboarding/checklist/${taskId}`, {
    method: "POST",
    headers: { "x-user-id": user.id },
  });
}

export async function incrementUsageStat(
  stat: "markets_viewed" | "scores_checked" | "reports_generated",
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await fetch(`${API_URL}/api/onboarding/usage/${stat}`, {
    method: "POST",
    headers: { "x-user-id": user.id },
  });
}

export async function dismissBeaconTask(beaconId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await fetch(`${API_URL}/api/onboarding/beacon/${beaconId}/dismiss`, {
    method: "POST",
    headers: { "x-user-id": user.id },
  });
}
