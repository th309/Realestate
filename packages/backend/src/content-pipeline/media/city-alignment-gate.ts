// packages/backend/src/content-pipeline/media/city-alignment-gate.ts
//
// Troy's media-alignment constraint in one place: every stock photo or clip must
// match the message subject. Fail-safe hierarchy is right media -> no media ->
// NEVER wrong media, so this gate is deliberately strict and returns false on
// any doubt. Shared by the photo and video search paths.

/**
 * Terms that mark a result as actual city/urban footage.
 *
 * Naming the city is NOT enough on its own: many US metros share a name with an
 * everyday noun, and Pexels' fuzzy search happily returns those. A live run
 * matched "Barre, VT" to `a-ballerina-training-on-a-barre` — the slug contains
 * "barre", so a bare substring test passed and a ballet clip was nearly shipped
 * as a real-estate video. Requiring an urban term alongside the city name
 * rejects that whole class (Barre, Reading, Mobile, Jackson, Corning, Sandwich).
 */
const URBAN_CONTEXT_TERMS = [
  'skyline',
  'downtown',
  'cityscape',
  'city',
  'urban',
  'aerial',
  'street',
  'building',
  'skyscraper',
  'bridge',
  'traffic',
  'neighborhood',
  'residential',
  'suburb',
  'architecture',
] as const;

const STATE_ABBREVIATIONS = [
  'al',
  'ak',
  'az',
  'ar',
  'ca',
  'co',
  'ct',
  'de',
  'fl',
  'ga',
  'hi',
  'id',
  'il',
  'in',
  'ia',
  'ks',
  'ky',
  'la',
  'me',
  'md',
  'ma',
  'mi',
  'mn',
  'ms',
  'mo',
  'mt',
  'ne',
  'nv',
  'nh',
  'nj',
  'nm',
  'ny',
  'nc',
  'nd',
  'oh',
  'ok',
  'or',
  'pa',
  'ri',
  'sc',
  'sd',
  'tn',
  'tx',
  'ut',
  'vt',
  'va',
  'wa',
  'wv',
  'wi',
  'wy',
  'dc',
] as const;

/**
 * Every market we publish is in the United States, and US city names are
 * exported all over the world. Live misses: Johnstown PA was served a peacock at
 * "Johnstown Castle, Ireland", and Bangor ME was served a marina in "Bangor,
 * Wales". A US-state check cannot catch those, so metadata naming a foreign
 * place disqualifies the result outright.
 */
const FOREIGN_PLACE_TERMS = [
  'wales',
  'ireland',
  'scotland',
  'england',
  'britain',
  'british',
  'uk',
  'united kingdom',
  'canada',
  'canadian',
  'australia',
  'new zealand',
  'germany',
  'france',
  'spain',
  'italy',
  'portugal',
  'netherlands',
  'belgium',
  'sweden',
  'norway',
  'denmark',
  'finland',
  'poland',
  'greece',
  'turkey',
  'russia',
  'ukraine',
  'mexico',
  'brazil',
  'argentina',
  'chile',
  'colombia',
  'india',
  'china',
  'japan',
  'korea',
  'thailand',
  'vietnam',
  'indonesia',
  'philippines',
  'malaysia',
  'singapore',
  'africa',
  'egypt',
  'morocco',
  'israel',
  'dubai',
  'emirates',
  'qatar',
  'europe',
  'european',
  'asia',
] as const;

/** Whole-word match, so "barre" never matches inside "barrelhouse". */
function wholeWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack);
}

function looksUrban(haystack: string): boolean {
  return URBAN_CONTEXT_TERMS.some((term) => haystack.includes(term));
}

/**
 * City names repeat across states. When the metadata names a state AND we know
 * which one we wanted, they must agree — otherwise "Johnstown, CO" gets shipped
 * as Johnstown, PA (a real miss). Metadata naming no state is allowed through:
 * most stock captions omit it, and the city + urban checks still apply.
 */
function stateConflicts(haystack: string, expectedState: string): boolean {
  const expected = expectedState.trim().toLowerCase();
  if (!expected) return false;
  const mentioned = STATE_ABBREVIATIONS.filter((abbr) =>
    wholeWord(haystack, abbr),
  );
  if (mentioned.length === 0) return false;
  return !mentioned.includes(expected as (typeof STATE_ABBREVIATIONS)[number]);
}

function namesForeignPlace(haystack: string): boolean {
  return FOREIGN_PLACE_TERMS.some((term) => wholeWord(haystack, term));
}

/**
 * A result is accepted only when its metadata names the city as a whole word,
 * reads as city footage, names no foreign place, and does not name a
 * conflicting US state.
 */
export function passesCityAlignmentGate(
  metadata: string,
  city: string,
  expectedState?: string | null,
): boolean {
  const haystack = metadata.toLowerCase();
  if (!wholeWord(haystack, city.toLowerCase())) return false;
  if (!looksUrban(haystack)) return false;
  if (namesForeignPlace(haystack)) return false;
  if (expectedState && stateConflicts(haystack, expectedState)) return false;
  return true;
}
