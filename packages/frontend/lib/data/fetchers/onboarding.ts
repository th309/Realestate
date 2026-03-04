/**
 * ONBOARDING FETCHERS
 *
 * Functions for reading and updating onboarding state and user preferences
 * stored in the user_profiles table.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
      "onboarding_completed_at, user_type, investment_goal, experience_level, preferred_markets",
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
