/**
 * Narrative Regeneration
 *
 * Handles re-generating specific narrative sections after user
 * personalization inputs change (income, priorities, timeline, etc.).
 *
 * Extracted from the former reports-narratives.ts (V1 pipeline).
 */

import { Logger, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Regenerate narratives after user personalization inputs change.
 *
 * Determines which narrative keys need regeneration based on which
 * inputs changed, updates the stored user_inputs, and returns the
 * keys that would be regenerated.
 */
export async function regenerateNarratives(
  supabaseClient: SupabaseClient,
  logger: Logger,
  reportId: string,
  userId: string,
  userInputs: Record<string, any>,
): Promise<{ updated_keys: string[]; ai_narrative: Record<string, any> }> {
  // 1. Fetch the report to verify ownership
  const { data: report, error } = await supabaseClient
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .eq('user_id', userId)
    .single();

  if (error || !report) {
    throw new NotFoundException('Report not found');
  }

  // 2. Determine which narrative keys need regeneration based on changed inputs
  const existingInputs = report.user_inputs || {};
  const keysToRegenerate: string[] = [];

  // Income/down payment changed -> regenerate affordability narratives
  if (
    userInputs.income !== existingInputs.income ||
    userInputs.down_payment !== existingInputs.down_payment
  ) {
    keysToRegenerate.push(
      'affordability_narrative',
      'affordability_personalized',
    );
  }

  // Priorities changed -> regenerate priority narratives
  if (
    JSON.stringify(userInputs.priorities) !==
    JSON.stringify(existingInputs.priorities)
  ) {
    keysToRegenerate.push('priorities_narrative', 'priorities_personalized');
  }

  // Timeline changed
  if (userInputs.timeline !== existingInputs.timeline) {
    keysToRegenerate.push('market_timing_personalized');
  }

  // Investment strategy changed (investor)
  if (userInputs.investment_strategy !== existingInputs.investment_strategy) {
    keysToRegenerate.push(
      'investment_thesis_narrative',
      'cash_flow_personalized',
    );
  }

  // Always regenerate bottom line when anything changes
  keysToRegenerate.push('bottom_line_narrative', 'bottom_line_actions');

  // 3. Update user_inputs on the report
  const { error: updateError } = await supabaseClient
    .from('reports')
    .update({ user_inputs: userInputs })
    .eq('id', reportId);

  if (updateError) {
    logger.error(`Failed to update user inputs: ${updateError.message}`);
  }

  // 4. For now, return the keys that would be regenerated
  // Full AI regeneration will be wired when the narrative service supports
  // selective regeneration
  const updatedNarrative = report.ai_narrative || {};

  return {
    updated_keys: keysToRegenerate,
    ai_narrative: updatedNarrative,
  };
}
