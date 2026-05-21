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
    allSections.forEach((id) => {
      const p = getSectionPrompt(id);
      expect(p.length).toBeLessThan(400);
    });
  });
});
