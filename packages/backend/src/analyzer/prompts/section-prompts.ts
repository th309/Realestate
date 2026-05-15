/**
 * Section prompts for analyzer AI insights.
 *
 * STUB — Task 1B.2 will replace with full per-section prompt strings.
 */

export type SectionId =
  | 'header_verdict'
  | 'projection'
  | 'expense_waterfall'
  | 'sensitivity'
  | 'comps'
  | 'market_context'
  | 'after_tax';

export function getSectionPrompt(_sectionId: SectionId): string {
  return 'Write 1-2 sentences interpreting the data above.';
}
