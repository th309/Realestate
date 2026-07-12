import { getSectionPrompt, SectionId } from '../section-prompts';

describe('section-prompts', () => {
  const allSections: SectionId[] = [
    'header_verdict',
    'projection',
    'expense_waterfall',
    'sensitivity',
    'comps',
    'market_context',
    'after_tax',
  ];

  it.each(allSections)('returns non-empty prompt for %s', (id) => {
    const p = getSectionPrompt(id);
    expect(p.length).toBeGreaterThan(40);
  });

  it('header_verdict requests verdict + reasoning + risk', () => {
    const p = getSectionPrompt('header_verdict');
    expect(p).toMatch(/buy|negotiate|pass/i);
    expect(p).toMatch(/risk/i);
  });

  it('all prompts are bounded (focused tasks)', () => {
    // Bound guards against these staying single/dual-sentence focused tasks
    // (as opposed to `recommendation_analysis`, deliberately excluded above
    // at ~3.8k chars). Raised from 400: both `projection` (527) and
    // `market_context` (478) have grown past 400 via deliberate accuracy
    // fixes (component-figure citation; PIQ probability framing) — see
    // baceb888 and 2e3249c4. 600 keeps headroom while still catching a
    // prompt accidentally regressing into essay-length.
    allSections.forEach((id) => {
      const p = getSectionPrompt(id);
      expect(p.length).toBeLessThan(600);
    });
  });
});
