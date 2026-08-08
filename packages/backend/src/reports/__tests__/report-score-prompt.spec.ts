import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPORT_SYSTEM_PROMPT_HOMEBUYER,
  REPORT_SYSTEM_PROMPT_INVESTOR,
  REPORT_SYSTEM_PROMPT_CUSTOM,
} from '../prompts-v2/system-prompt';

/**
 * A generated report narrated "PropertyIQ score of 2 out of 100". The model
 * was not hallucinating - the prompt handed it `{{propertyiq_score}}/100` and
 * a scoring reference describing percentile ranks on a 0-100 scale, a grade
 * ladder derived from the score, and "50 means MEDIAN". All of that describes
 * the retired three-score model.
 *
 * The score is 1-99, 50 is the market's own STATE average, and it measures
 * demand MOMENTUM, not quality (CLAUDE.md section 9). These assertions pin
 * that down at the prompt layer, which is where the wrong copy originates.
 */
const SYSTEM_PROMPTS = [
  ['homebuyer', REPORT_SYSTEM_PROMPT_HOMEBUYER],
  ['investor', REPORT_SYSTEM_PROMPT_INVESTOR],
  ['custom', REPORT_SYSTEM_PROMPT_CUSTOM],
] as const;

const SECTION_FILES = [
  'comparison-sections.ts',
  'homeready-sections.ts',
  'investor-sections.ts',
];

const readSection = (name: string) =>
  readFileSync(join(__dirname, '..', 'prompts-v2', name), 'utf8');

describe('report prompts state the PropertyIQ Score correctly', () => {
  describe.each(SYSTEM_PROMPTS)('%s system prompt', (_name, prompt) => {
    it('states the 1 to 99 range', () => {
      expect(prompt).toContain('1 to 99');
    });

    it('explicitly forbids the 100-point scale', () => {
      // Asserted as a prohibition rather than absence of the string: the rule
      // has to NAME the thing it bans, so "out of 100" legitimately appears
      // here. What must not appear is the model being handed that scale, and
      // that is asserted against the section files below.
      expect(prompt).toMatch(/NEVER describe it as being out of 100/);
    });

    it('anchors 50 to the state average, not a national median', () => {
      expect(prompt).toMatch(/state average/i);
      expect(prompt).not.toMatch(/50 means MEDIAN/i);
    });

    it('frames the score as momentum, not quality', () => {
      expect(prompt).toMatch(/momentum/i);
      expect(prompt).toContain('VERY STRONG');
      expect(prompt).toContain('EASING');
    });

    it('does not derive a letter grade from the score', () => {
      // A+/A-/B+ ladders were the retired quality model. The only letter
      // grade in play is confidence, which is data quality.
      expect(prompt).not.toMatch(/A\+ \(95\+\)/);
    });

    it('keeps confidence separate from the score', () => {
      expect(prompt).toMatch(/confidence/i);
      expect(prompt).toMatch(/DATA QUALITY/i);
    });
  });

  describe.each(SECTION_FILES)('%s', (file) => {
    it('does not hand the model a /100 denominator', () => {
      expect(readSection(file)).not.toContain('{{propertyiq_score}}/100');
    });
  });

  it('its worked example models the rules it teaches', () => {
    const homeready = readSection('homeready-sections.ts');
    const good = homeready
      .split('\n')
      .find(
        (line) => line.startsWith('GOOD:') && line.includes('propertyiq_score'),
      );
    expect(good).toBeDefined();
    // The example is few-shot: whatever it demonstrates, the model copies.
    expect(good).not.toMatch(/\/100|out of 100/);
    expect(good).not.toMatch(/[—–]/); // the same prompt bans em and en dashes
  });
});
