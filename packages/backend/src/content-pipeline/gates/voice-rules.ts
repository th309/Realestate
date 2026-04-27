// packages/backend/src/content-pipeline/gates/voice-rules.ts

/**
 * Approved brand taglines and signature phrases. The LLM judge MUST NOT
 * flag these as marketing-heavy or hypey, since they ARE the brand voice
 * (per CLAUDE.md §8.0). Edit alongside the brand spec, not in isolation.
 */
export const APPROVED_TAGLINES = [
  'The IQ Behind Every Market',
  'The IQ behind every market',
  'PropertyIQ. Now you know.',
  'PropertyIQ. The IQ behind every market.',
  'Now you know.',
];

export const FORBIDDEN_PHRASES = [
  'game-changer',
  'game changer',
  'gamechanger',
  'crushing it',
  'absolutely crushing',
  'absolutely',
  'no-brainer',
  'no brainer',
  "you won't believe",
  'you wont believe',
  'insane',
  'crazy good',
  'literally',
  'tbh',
  'omg',
  'investor edge',
  'investoredge',
  'home ready',
  'homeready',
  'market health index',
];
export const EM_DASH_CHARS = ['—', '–']; // em dash U+2014, en dash U+2013
export const SCORE_REFERENCE_REGEX = /\bscore\b/gi;
export const APPROVED_SCORE_PREFIXES = /(propertyiq score|piq score)/i;
