// packages/backend/src/content-pipeline/style-preferences/style-preference-preamble.ts
//
// Pure builder for the style block a generator appends to its brand preamble.
// Mirrors brand-preamble.ts: no Nest, no I/O, so it is unit-testable on its own
// and the wording can be reviewed without running a generation.
//
// ── signal_weight semantics (the one place they are defined) ────────────────
// `collections_preferences.signal_weight` is a 0..2 dial on how hard the saved
// looks steer generation. It changes the DIRECTIVE, never the facts:
//
//   0            off      no block emitted at all. Likes are kept, just muted,
//                         so an operator can A/B "with vs without" without
//                         unsaving anything.
//   0 < w < 0.7  light    loose inspiration; borrow the mood, ignore details.
//   0.7 ≤ w ≤ 1.3 default the house look (1.0 is the column default).
//   w > 1.3      strong   treated as a constraint, matched closely.
//
// Weight deliberately does NOT change how many references are included: a
// bounded, stable set keeps prompt size and cost predictable, and lets the dial
// mean exactly one thing. The most recently saved MAX_REFS_IN_PREAMBLE win.

/** Reference attributes the block is built from (a hydrated style reference). */
export interface StylePreferenceRefInput {
  label: string;
  palette?: string[];
  typography?: string[];
  layout?: string[];
  summary?: string;
}

export const STYLE_SIGNAL_WEIGHT_MIN = 0;
export const STYLE_SIGNAL_WEIGHT_MAX = 2;
export const STYLE_SIGNAL_WEIGHT_DEFAULT = 1;

/** Most-recent saved references included in a prompt (cost/size bound). */
export const MAX_REFS_IN_PREAMBLE = 5;

// Per-reference truncation, so one verbose Vision summary cannot dominate.
const MAX_LABEL_CHARS = 80;
const MAX_SUMMARY_CHARS = 240;
const MAX_PALETTE_SWATCHES = 6;
const MAX_DESCRIPTORS = 4;

export type StyleSignalStrength = 'off' | 'light' | 'default' | 'strong';

/** Bucket a raw signal_weight into the directive strength it expresses. */
export function styleSignalStrength(weight: number): StyleSignalStrength {
  if (!Number.isFinite(weight) || weight <= 0) return 'off';
  if (weight < 0.7) return 'light';
  if (weight <= 1.3) return 'default';
  return 'strong';
}

const STRENGTH_DIRECTIVE: Record<
  Exclude<StyleSignalStrength, 'off'>,
  string
> = {
  light: 'loose inspiration, borrow the mood and energy but not the specifics',
  default: 'the house look, follow it unless the brief says otherwise',
  strong: 'a hard constraint, match them closely',
};

/** Clamp any stored/submitted weight into the supported range. */
export function clampSignalWeight(weight: number): number {
  if (!Number.isFinite(weight)) return STYLE_SIGNAL_WEIGHT_DEFAULT;
  return Math.min(
    STYLE_SIGNAL_WEIGHT_MAX,
    Math.max(STYLE_SIGNAL_WEIGHT_MIN, weight),
  );
}

function truncate(value: string, max: number): string {
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function descriptors(values: string[] | undefined, max: number): string[] {
  return (values ?? [])
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .slice(0, max);
}

/** One "- Label: summary. Colors… Type… Layout…" line. */
function refLine(ref: StylePreferenceRefInput): string | null {
  const label = truncate(String(ref.label ?? ''), MAX_LABEL_CHARS);
  if (!label) return null;

  const parts: string[] = [];
  const summary = truncate(String(ref.summary ?? ''), MAX_SUMMARY_CHARS);
  if (summary) parts.push(summary.endsWith('.') ? summary : `${summary}.`);

  const palette = descriptors(ref.palette, MAX_PALETTE_SWATCHES);
  if (palette.length) parts.push(`Colors: ${palette.join(', ')}.`);

  const typography = descriptors(ref.typography, MAX_DESCRIPTORS);
  if (typography.length) parts.push(`Type: ${typography.join(', ')}.`);

  const layout = descriptors(ref.layout, MAX_DESCRIPTORS);
  if (layout.length) parts.push(`Layout: ${layout.join(', ')}.`);

  // A reference with no extracted attributes yet still names a look worth
  // honouring, so it keeps its line rather than being dropped.
  return parts.length ? `- ${label}: ${parts.join(' ')}` : `- ${label}`;
}

/**
 * Build the saved-style block for a prompt preamble. Returns '' when the signal
 * is off or nothing usable is saved, so callers can concatenate unconditionally.
 */
export function buildStylePreferencePreamble(
  refs: StylePreferenceRefInput[],
  signalWeight: number,
): string {
  const strength = styleSignalStrength(signalWeight);
  if (strength === 'off') return '';

  const lines = refs
    .slice(0, MAX_REFS_IN_PREAMBLE)
    .map(refLine)
    .filter((line): line is string => line !== null);
  if (lines.length === 0) return '';

  return [
    `SAVED STYLE PREFERENCES (looks this brand has endorsed, treat as ${STRENGTH_DIRECTIVE[strength]}):`,
    ...lines,
    '',
    'Write copy that suits these looks: match their density and rhythm, and keep any headline short enough to sit large on the page. Never describe the styling itself in the copy.',
  ].join('\n');
}
