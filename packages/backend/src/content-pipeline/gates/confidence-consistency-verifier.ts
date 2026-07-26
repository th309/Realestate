// packages/backend/src/content-pipeline/gates/confidence-consistency-verifier.ts
import { extractDataConfidenceMentions } from './confidence-letter-mentions';
import type { ConfidenceLetterViolation } from './gate.types';

/**
 * Ensures any narrative mention of data-confidence letters (A–F) matches
 * `score.confidence` from the MCP bundle (same letter shown on score visuals).
 */
export function verifyConfidenceConsistency(
  scriptText: string,
  mcpPayload: unknown,
): ConfidenceLetterViolation[] {
  const mentions = extractDataConfidenceMentions(scriptText);
  if (mentions.length === 0) return [];

  const bundle = mcpPayload as Record<string, unknown> | null;
  const score = bundle?.score as { confidence?: string } | undefined;
  const raw =
    typeof score?.confidence === 'string'
      ? score.confidence.trim().toUpperCase()
      : '';
  const expected = /^[A-F]$/.test(raw) ? raw : null;

  const violations: ConfidenceLetterViolation[] = [];
  if (!expected) {
    for (const m of mentions) {
      violations.push({
        quote: m.quote,
        statedLetter: m.letter,
        expectedLetter: null,
        reason: 'confidence_stated_without_bundle',
      });
    }
    return violations;
  }

  for (const m of mentions) {
    if (m.letter !== expected) {
      violations.push({
        quote: m.quote,
        statedLetter: m.letter,
        expectedLetter: expected,
        reason: 'confidence_mismatch',
      });
    }
  }
  return violations;
}
