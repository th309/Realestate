/**
 * RESEARCH BRIEF DATA FETCHERS
 *
 * API functions for the custom research brief generation pipeline.
 * Endpoints:
 * - POST /api/reports/research/clarify  — get scoping questions
 * - POST /api/reports/research/generate — run full research + narrative
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClarifyingQuestionOption {
  value: string;
  label: string;
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  options: ClarifyingQuestionOption[];
}

export interface ClarifyingQuestionsResponse {
  questions: ClarifyingQuestion[];
}

export interface ResearchBriefResponse {
  narrative: string;
  research_data: Record<string, unknown>;
  tool_call_count: number;
  duration_ms: number;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Request clarifying questions for a research topic.
 *
 * POST /api/reports/research/clarify
 */
export async function fetchClarifyingQuestions(
  question: string,
  context?: string,
): Promise<ClarifyingQuestionsResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/reports/research/clarify`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question, context }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to fetch clarifying questions: ${response.status}`,
    );
  }

  return response.json();
}

/**
 * Generate a full research brief from question + clarifying answers.
 *
 * POST /api/reports/research/generate
 *
 * NOTE: This is a long-running request (10-60s) due to multi-step AI pipeline.
 * The caller should show a progress indicator while waiting.
 */
export async function generateResearchBrief(
  question: string,
  clarifyingAnswers?: Record<string, string>,
  context?: string,
  signal?: AbortSignal,
): Promise<ResearchBriefResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/reports/research/generate`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      clarifying_answers: clarifyingAnswers,
      context,
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to generate research brief: ${response.status}`,
    );
  }

  return response.json();
}
