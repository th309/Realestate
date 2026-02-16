/**
 * REPORT DATA FETCHERS
 *
 * API functions for report-specific operations.
 */

import { API_URL } from './base';

interface RegenerateNarrativesRequest {
  user_inputs: Record<string, unknown>;
}

interface RegenerateNarrativesResponse {
  updated_keys: string[];
  ai_narrative: Record<string, string | string[]>;
}

/**
 * Request narrative regeneration for a report based on updated user inputs.
 *
 * @param reportId - The report to regenerate narratives for
 * @param userInputs - Updated user inputs (priorities, income, etc.)
 * @param signal - Optional AbortSignal for cancellation
 * @returns The updated narrative keys and content
 */
export async function regenerateNarratives(
  reportId: string,
  userInputs: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<RegenerateNarrativesResponse> {
  const response = await fetch(`${API_URL}/api/reports/${reportId}/regenerate-narratives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_inputs: userInputs } satisfies RegenerateNarrativesRequest),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to regenerate narratives: ${response.status}`);
  }

  return response.json();
}
