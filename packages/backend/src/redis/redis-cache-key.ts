/**
 * Redis Cache Key Builder
 *
 * Pure utility for building normalized, deterministic cache keys.
 * Handles JSON key ordering, state name canonicalization, and default value omission.
 */

const STATE_ABBREV_MAP: Record<string, string> = {
  texas: 'TX',
  california: 'CA',
  florida: 'FL',
  'new york': 'NY',
  arizona: 'AZ',
  'north carolina': 'NC',
  georgia: 'GA',
  tennessee: 'TN',
  colorado: 'CO',
  washington: 'WA',
  ohio: 'OH',
  illinois: 'IL',
  michigan: 'MI',
  virginia: 'VA',
  massachusetts: 'MA',
  pennsylvania: 'PA',
  oregon: 'OR',
  nevada: 'NV',
  utah: 'UT',
  minnesota: 'MN',
};

function canonicalizeState(state: string): string {
  if (!state || typeof state !== 'string') return state;
  const lower = state.toLowerCase().trim();
  if (state.length === 2 && state === state.toUpperCase()) return state;
  return STATE_ABBREV_MAP[lower] || state;
}

function isStateName(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const lower = str.toLowerCase().trim();
  return (
    lower in STATE_ABBREV_MAP || (str.length === 2 && str === str.toUpperCase())
  );
}

function normalizeParams(params: Record<string, any>): any {
  if (params === null || params === undefined) return {};

  if (Array.isArray(params)) {
    return params.map((p) => normalizeParams(p)).sort();
  }

  if (typeof params === 'object') {
    const normalized: Record<string, any> = {};
    const sortedKeys = Object.keys(params).sort();

    for (const key of sortedKeys) {
      const value = params[key];

      if (value === undefined || value === null || value === '') continue;
      if (key === 'ascending' && value === false) continue;
      if (key === 'limit' && value === 10) continue;

      if (key === 'states' && Array.isArray(value)) {
        normalized[key] = value.map((s) => canonicalizeState(s)).sort();
      } else if (typeof value === 'object') {
        normalized[key] = normalizeParams(value);
      } else if (typeof value === 'string' && isStateName(value)) {
        normalized[key] = canonicalizeState(value);
      } else {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  return params;
}

export function buildCacheKey(
  toolName: string,
  args: Record<string, any>,
): string {
  const normalized = normalizeParams(args);
  const paramStr = JSON.stringify(normalized);
  return `tool:v1:${toolName}:${paramStr}`;
}
