// Pure types + constants for style preferences. Kept free of the fetch layer so
// presentational components can import them without pulling in the data layer.

/** A saved style reference joined with its live extracted attributes. */
export interface SavedStyleRef {
  style_reference_id: string;
  label: string;
  saved_at: string;
  /** False when the underlying reference was deleted from the library. */
  exists: boolean;
  palette: string[];
  typography: string[];
  layout: string[];
  summary: string;
}

export interface StylePreferences {
  brandId: string;
  /** 0 to 2. See STRENGTH_STEPS for the four settings the UI exposes. */
  signalWeight: number;
  savedStyleRefs: SavedStyleRef[];
  /** The exact block appended to the generation prompt at this weight. */
  stylePreamble: string;
}

/**
 * The backend stores signalWeight as a continuous 0..2 number, but only four
 * distinct behaviours exist (see style-preference-preamble.ts), so the UI
 * exposes those four rather than implying a precision that is not there.
 */
export const STRENGTH_STEPS = [
  { label: "Off", weight: 0 },
  { label: "Light", weight: 0.5 },
  { label: "House look", weight: 1 },
  { label: "Strong", weight: 1.7 },
] as const;

/** The step a stored weight falls into, for rendering the active segment. */
export function strengthStepFor(
  weight: number,
): (typeof STRENGTH_STEPS)[number] {
  if (weight <= 0) return STRENGTH_STEPS[0];
  if (weight < 0.7) return STRENGTH_STEPS[1];
  if (weight <= 1.3) return STRENGTH_STEPS[2];
  return STRENGTH_STEPS[3];
}
