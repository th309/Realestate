// packages/backend/src/content-pipeline/gates/voice-rules.ts
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
