// packages/backend/src/content-pipeline/infographics/infographic-focus-prompt.ts
import type { InfographicStyle } from './infographic-styles';
import type {
  InfographicTopic,
  InfographicTopicTask,
} from './infographic-topics';

/** The one footer line every infographic carries, verbatim. */
export const INFOGRAPHIC_FOOTER =
  'propertyiq.app - Market-level intelligence. Not property valuation.';

/**
 * Constraints that stop the image model fabricating. Every rule here exists
 * because a generated sample broke it: models invent numbers, spell the domain
 * "propertylq", letter decorative props with gibberish, and label gauge ticks
 * they have no data for.
 */
const ANTI_FABRICATION_RULES = [
  'FACTS: use ONLY facts stated in the source document. Do not add, infer, ' +
    'extrapolate or "improve" any fact, number, date, name or feature. If the ' +
    'source does not state it, leave it out.',
  'COVERAGE NUMBERS: if coverage is shown, write it exactly as "900+ metros, ' +
    '3,000+ counties, 29,000+ ZIPs". Keep the plus signs. Never replace these ' +
    'with exact-looking counts and never invent different figures.',
  'SOURCES: list data sources on ONE single caption line, spelled exactly: ' +
    'Zillow, Realtor.com, Census, FRED, BLS. No other sources. Do not repeat ' +
    'the source line anywhere else on the graphic.',
  'DOMAIN SPELLING: the domain is spelled p-r-o-p-e-r-t-y-i-q.app — the ninth ' +
    'character is a lowercase letter i, not a lowercase letter L. Render it as ' +
    'propertyiq.app. Do NOT render "propertylq", which is a recurring failure.',
  'DECORATIVE OBJECTS: any decorative or background object (props, devices, ' +
    'signage, charts used as ornament) must carry NO text or lettering at all. ' +
    'Text appears only in real labels, titles and captions.',
  'GAUGES: if a gauge, dial or arc scale appears, label ONLY the value 50 at ' +
    'its centre. No other tick numbers, no end labels, no ranges.',
  'NO SCORE BANDS OR PERFORMANCE STATS: do not show score bands, percentile ' +
    'bands, back-test results, excess-return figures or any historical ' +
    'performance statistic.',
  'NO UNDERSCORES: never use an underscore character anywhere in visible text. ' +
    'Use hyphens or spaces.',
  'TEXT DENSITY: prefer fewer, larger text elements. Short phrases over ' +
    'sentences. Every word must be comfortably legible at a glance — do not ' +
    'crowd the layout with small type.',
  `FOOTER: end with exactly this one footer line: ${INFOGRAPHIC_FOOTER}`,
] as const;

/**
 * The `--focus` argument for `nlm infographic create`: which single task to
 * cover, the anti-fabrication rules, and the pinned visual style descriptor.
 *
 * One task per graphic is a hard product rule — a topic doc describes a family
 * of tasks, but each run covers exactly one of them.
 */
export function buildInfographicFocusPrompt(input: {
  topic: InfographicTopic;
  task: InfographicTopicTask;
  style: InfographicStyle;
}): string {
  const { topic, task, style } = input;

  return [
    `Create ONE infographic covering exactly one task from the source document: ` +
      `task ${task.number}, "${task.label}", from "${topic.title}".`,
    '',
    'Cover ONLY that single task. Do not summarise the other tasks in the ' +
      'document, do not build an overview of the whole topic, and do not add a ' +
      'list of other features. One task, explained well.',
    '',
    'RULES:',
    ...ANTI_FABRICATION_RULES.map((rule) => `- ${rule}`),
    '',
    style.descriptor,
  ].join('\n');
}
