// packages/backend/src/content-pipeline/drivers/ranking-prior-feedback-block.ts
import { ScriptGateFeedback } from './script-generator.interface';

/**
 * Build a "Previous attempt feedback" block from gate violations recorded by
 * earlier script-repair attempts. Returns empty string when there's no prior
 * feedback so the prompt stays clean for first attempts.
 */
export function buildPriorFeedbackBlock(
  feedback: ScriptGateFeedback[] | undefined,
): string {
  if (!feedback || feedback.length === 0) return '';
  const lines: string[] = [];
  for (const entry of feedback) {
    lines.push(`\n## Attempt — ${entry.gate}`);
    for (const v of entry.violations) {
      const quote = v.quote ? `"${v.quote}"` : '(no quote)';
      lines.push(`- ${quote} — ${v.issue}`);
    }
  }
  return [
    '',
    '# Previous attempt feedback',
    '',
    'Earlier scripts failed the listed gate(s) on the violations below. Address each one. Do not introduce new violations of the same kind.',
    ...lines,
    '',
  ].join('\n');
}
