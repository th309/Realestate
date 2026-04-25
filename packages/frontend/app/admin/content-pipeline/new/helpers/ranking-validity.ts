export type GeoLevel = "metro" | "county" | "zip";
export type ScopeType = "national" | "state" | "metro";

/**
 * Validity matrix: which GeoLevels are allowed for each ScopeType.
 *
 * - national: can rank metro, county, or zip
 * - state:    can rank metro, county, or zip
 * - metro:    can rank only zip
 */
const MATRIX: Record<ScopeType, GeoLevel[]> = {
  national: ["metro", "county", "zip"],
  state: ["metro", "county", "zip"],
  metro: ["zip"],
};

/**
 * Returns the list of valid GeoLevels for a given ScopeType.
 *
 * @param scope - The scope type (national, state, or metro)
 * @returns Array of valid geo levels for that scope
 */
export const validLevelsForScope = (scope: ScopeType): GeoLevel[] =>
  MATRIX[scope];

/**
 * Returns the list of valid ScopeTypes that support a given GeoLevel.
 *
 * @param level - The geo level (metro, county, or zip)
 * @returns Array of scopes that accept that level
 */
export const validScopesForLevel = (level: GeoLevel): ScopeType[] =>
  (Object.keys(MATRIX) as ScopeType[]).filter((s) => MATRIX[s].includes(level));

/**
 * Checks if a GeoLevel is valid for a given ScopeType.
 *
 * @param level - The geo level
 * @param scope - The scope type
 * @returns true if the combination is valid, false otherwise
 */
export const isValidCombo = (level: GeoLevel, scope: ScopeType): boolean =>
  MATRIX[scope].includes(level);
