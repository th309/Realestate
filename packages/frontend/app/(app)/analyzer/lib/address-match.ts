/**
 * Address comparison behind the "RentCast matched a different property" warning.
 *
 * The warning earns its place when RentCast substitutes a DIFFERENT building:
 * you type 123 S Market St, RentCast has no record there, snaps to 125, and
 * every number on the page — AVM, rent, sqft, tax, all 30 comps — now describes
 * the neighbour. That is worth interrupting someone over.
 *
 * It must NOT fire on formatting. RentCast answers in USPS-abbreviated form
 * ("125 S Market St, Frederick, MD 21701") while Mapbox autocomplete hands us
 * the expanded form ("125 South Market Street, Frederick, Maryland 21701").
 * Same house. The previous check lowercased and collapsed commas and nothing
 * else, so `south market street` !== `s market st` and `maryland` !== `md` lit
 * the banner on essentially every autocomplete selection. A warning that cries
 * wolf on correct data is worse than no warning — users learn to dismiss it,
 * and then miss the real 123-vs-125 substitution it exists to catch.
 */

/** USPS suffix abbreviations. Expanded form on the left, canonical on right. */
const STREET_SUFFIXES: Record<string, string> = {
  street: "st",
  avenue: "ave",
  road: "rd",
  drive: "dr",
  boulevard: "blvd",
  lane: "ln",
  court: "ct",
  place: "pl",
  terrace: "ter",
  circle: "cir",
  parkway: "pkwy",
  highway: "hwy",
  square: "sq",
  trail: "trl",
  crossing: "xing",
  plaza: "plz",
  ridge: "rdg",
  point: "pt",
  alley: "aly",
  extension: "ext",
  turnpike: "tpke",
  expressway: "expy",
  freeway: "fwy",
  junction: "jct",
  landing: "lndg",
  mount: "mt",
  village: "vlg",
};

const DIRECTIONALS: Record<string, string> = {
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
};

/** Secondary-unit designators, all folded to a single token. */
const UNIT_MARKERS: Record<string, string> = {
  apartment: "unit",
  apt: "unit",
  suite: "unit",
  ste: "unit",
  building: "unit",
  bldg: "unit",
  floor: "unit",
  fl: "unit",
  unit: "unit",
};

const STATES: Record<string, string> = {
  alabama: "al",
  alaska: "ak",
  arizona: "az",
  arkansas: "ar",
  california: "ca",
  colorado: "co",
  connecticut: "ct",
  delaware: "de",
  florida: "fl",
  georgia: "ga",
  hawaii: "hi",
  idaho: "id",
  illinois: "il",
  indiana: "in",
  iowa: "ia",
  kansas: "ks",
  kentucky: "ky",
  louisiana: "la",
  maine: "me",
  maryland: "md",
  massachusetts: "ma",
  michigan: "mi",
  minnesota: "mn",
  mississippi: "ms",
  missouri: "mo",
  montana: "mt",
  nebraska: "ne",
  nevada: "nv",
  "new hampshire": "nh",
  "new jersey": "nj",
  "new mexico": "nm",
  "new york": "ny",
  "north carolina": "nc",
  "north dakota": "nd",
  ohio: "oh",
  oklahoma: "ok",
  oregon: "or",
  pennsylvania: "pa",
  "rhode island": "ri",
  "south carolina": "sc",
  "south dakota": "sd",
  tennessee: "tn",
  texas: "tx",
  utah: "ut",
  vermont: "vt",
  virginia: "va",
  washington: "wa",
  "west virginia": "wv",
  wisconsin: "wi",
  wyoming: "wy",
  "district of columbia": "dc",
};

/**
 * Fold an address to a canonical token string: lowercase, punctuation-free,
 * USPS-abbreviated. "125 South Market Street, Frederick, Maryland 21701" and
 * "125 S Market St, Frederick, MD 21701" both become
 * "125 s market st frederick md 21701".
 *
 * Multi-word states are collapsed BEFORE tokenizing, since "new york" has to
 * match as a pair rather than as two independent words.
 */
export function normalizeAddress(raw: string): string {
  let s = raw
    .toLowerCase()
    // "#5" and "unit 5" should agree; drop the sigil and let UNIT_MARKERS fold.
    .replace(/#/g, " unit ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [long, abbr] of Object.entries(STATES)) {
    if (long.includes(" "))
      s = s.replace(new RegExp(`\\b${long}\\b`, "g"), abbr);
  }

  return s
    .split(" ")
    .filter(Boolean)
    .map(
      (t) =>
        STREET_SUFFIXES[t] ??
        DIRECTIONALS[t] ??
        UNIT_MARKERS[t] ??
        STATES[t] ??
        t,
    )
    .join(" ");
}

/**
 * The street line's name portion: house number, unit, and any trailing
 * city/state/ZIP removed. "125 S Market St, Frederick, MD 21701" → "s market st".
 *
 * Taken from the first comma segment, which both Mapbox and RentCast use for
 * the street line. Unit designators are truncated rather than kept, so
 * "5 W South St Apt 5" and "5 W South St, Unit 5" agree.
 */
export function extractStreetCore(raw: string): string {
  let tokens = normalizeAddress(raw.split(",")[0]).split(" ").filter(Boolean);
  if (tokens.length > 0 && /^\d+[a-z]?$/.test(tokens[0]))
    tokens = tokens.slice(1);
  const unitAt = tokens.indexOf("unit");
  if (unitAt !== -1) tokens = tokens.slice(0, unitAt);
  // Only reachable for comma-less input, where the segment swallowed the ZIP.
  return tokens.filter((t) => !/^\d{5}$/.test(t)).join(" ");
}

/** The tokens that identify a building rather than describe it. */
export function extractAddressIdentity(raw: string): {
  streetNumber: string | null;
  zip: string | null;
  streetCore: string;
} {
  const normalized = normalizeAddress(raw);
  // Leading house number, e.g. "125" or "125a" in "125a s market st".
  const numberMatch = normalized.match(/^(\d+[a-z]?)\b/);
  // ZIP anywhere; ZIP+4 compares on the 5-digit base.
  const zipMatch = normalized.match(/\b(\d{5})(?:-\d{4})?\b/);
  return {
    streetNumber: numberMatch ? numberMatch[1] : null,
    zip: zipMatch ? zipMatch[1] : null,
    streetCore: extractStreetCore(raw),
  };
}

/**
 * Whether RentCast's match should be flagged to the user.
 *
 * THE RULE: warn when the street number, the ZIP, or the street NAME disagrees.
 *
 * Those three are what separate "same building, different spelling" from "wrong
 * building". Everything else — suffix form, directional form, state form, unit
 * punctuation, "Frederick" vs "Frederick City" — is presentation, and RentCast
 * and Mapbox disagree about it constantly on correct matches.
 *
 * The street name is load-bearing, not decoration: house number 125 exists on
 * most streets in a given ZIP, so number+ZIP alone would sit silent on
 * "125 Market St" resolving to "125 Elm St" — a different building with every
 * figure on the page wrong. Caught in review; there is a regression test for it.
 *
 * Street names compare by prefix rather than equality, because a comma-less
 * typed address ("125 South Market Street Frederick Maryland") leaves the city
 * inside the street segment. "s market st" prefixes "s market st frederick md",
 * so that stays quiet, while "market st" vs "elm st" still conflicts.
 *
 * A missing token is NOT treated as a mismatch: a user who typed "S Market St,
 * Frederick MD" with no house number has given us nothing to contradict, and
 * inventing a warning there is the same false alarm in a new costume.
 */
export function isRealAddressMismatch(
  typedAddress: string,
  resolvedAddress: string,
): boolean {
  if (!typedAddress.trim() || !resolvedAddress.trim()) return false;
  if (normalizeAddress(typedAddress) === normalizeAddress(resolvedAddress)) {
    return false;
  }

  const typed = extractAddressIdentity(typedAddress);
  const resolved = extractAddressIdentity(resolvedAddress);

  const numberConflicts =
    typed.streetNumber != null &&
    resolved.streetNumber != null &&
    typed.streetNumber !== resolved.streetNumber;

  const zipConflicts =
    typed.zip != null && resolved.zip != null && typed.zip !== resolved.zip;

  const streetConflicts =
    typed.streetCore.length > 0 &&
    resolved.streetCore.length > 0 &&
    !typed.streetCore.startsWith(resolved.streetCore) &&
    !resolved.streetCore.startsWith(typed.streetCore);

  return numberConflicts || zipConflicts || streetConflicts;
}
