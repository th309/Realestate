// packages/backend/src/content-pipeline/infographics/infographic-styles.ts
/**
 * Troy's six approved infographic reference looks (2026-07-26).
 *
 * A generator style flag alone is a loose genre hint, not a style spec — passing
 * `--style editorial` with no descriptor let NotebookLM freestyle steampunk and
 * Victorian sketch scenes. Every generation prompt therefore carries an explicit
 * VISUAL STYLE paragraph (background, palette, illustration mode, typography
 * feel) plus a NO-list, paired with the closest CLI style flag.
 *
 * Never invent a style: only these six ids are generatable.
 */

/** Style flags the `nlm infographic create --style` flag accepts for our looks. */
export type InfographicCliStyle =
  | 'editorial'
  | 'professional'
  | 'sketch_note'
  | 'bento_grid'
  | 'instructional';

export interface InfographicStyle {
  id: string;
  label: string;
  cliStyle: InfographicCliStyle;
  descriptor: string;
}

/** Failure modes every look must exclude — appended to each descriptor. */
const SHARED_NO_LIST =
  'NO steampunk, NO Victorian or antique engraving scenes, NO photorealism or ' +
  'photographic collage, NO 3D renders, NO dark or neon cyber aesthetic, and NO ' +
  'cartoon characters unless this style explicitly calls for a mascot.';

export const INFOGRAPHIC_STYLES: readonly InfographicStyle[] = [
  {
    id: 'flat-editorial',
    label: 'Flat editorial',
    cliStyle: 'editorial',
    descriptor:
      'VISUAL STYLE: flat editorial magazine layout on a warm cream background, ' +
      'organised as a clean grid of rectangular panels with generous margins and ' +
      'clear gutters. Palette is cream paper, deep slate blue, mustard yellow and ' +
      'rust orange, used as flat fills with no gradients, no drop shadows and no ' +
      'texture. Illustration mode is simple flat vector iconography and geometric ' +
      'shapes — solid silhouettes, minimal line weight, no shading. Typography is ' +
      'confident editorial sans-serif: one large headline, short bold panel titles, ' +
      'and small body lines with plenty of white space. ' +
      SHARED_NO_LIST,
  },
  {
    id: 'flat-editorial-map',
    label: 'Flat editorial with US map',
    cliStyle: 'editorial',
    descriptor:
      'VISUAL STYLE: flat editorial layout on a warm cream background built around ' +
      'a simplified United States map motif as the central visual anchor, with ' +
      'supporting flat panels arranged around it. The map is a plain flat vector ' +
      'silhouette of the continental US — solid fills, no terrain, no borders ' +
      'beyond state outlines, no pins with photographs. Palette is cream paper, ' +
      'deep slate blue, mustard yellow and rust orange as flat fills, no gradients ' +
      'or shadows. Typography is editorial sans-serif with one large headline and ' +
      'short bold labels. ' +
      SHARED_NO_LIST,
  },
  {
    id: 'clean-modern-flat',
    label: 'Clean modern flat',
    cliStyle: 'professional',
    descriptor:
      'VISUAL STYLE: clean modern flat business graphic on a light grey background, ' +
      'built around a large semicircular arc scale as the hero element with tidy ' +
      'supporting blocks beneath it. Palette is light grey, white, indigo blue and ' +
      'a single accent green, applied as flat fills with crisp edges, no gradients ' +
      'and no skeuomorphic gloss. Illustration mode is minimal geometric vector ' +
      'shapes and thin-stroke icons. Typography is a modern geometric sans-serif: ' +
      'one dominant number or headline, restrained supporting labels, generous ' +
      'white space. ' +
      SHARED_NO_LIST,
  },
  {
    id: 'sketch-note',
    label: 'Sketch note',
    cliStyle: 'sketch_note',
    descriptor:
      'VISUAL STYLE: hand-drawn sketch-note on a cream paper background, as if ' +
      'drawn by hand with a fine marker. Illustration mode is loose ink linework ' +
      'with visible hand-drawn wobble, simple doodle icons, hand-drawn arrows and ' +
      'connectors, and occasional circled or underlined emphasis. Palette is cream ' +
      'paper with dark ink linework plus one or two muted accent colours used ' +
      'sparingly as rough highlighter fills. Typography is neat hand-lettered ' +
      'sans-serif in varied sizes, headings larger and heavier than body notes. ' +
      'Keep it friendly and legible, not scratchy or chaotic. ' +
      SHARED_NO_LIST,
  },
  {
    id: 'glassmorphic-bento',
    label: 'Glassmorphic bento',
    cliStyle: 'bento_grid',
    descriptor:
      'VISUAL STYLE: glassmorphic bento grid — a modular layout of rounded ' +
      'rectangular tiles of varying sizes, tightly packed with even gutters. Tiles ' +
      'read as frosted translucent glass with soft blur, a subtle light border and ' +
      'a gentle shadow, floating over a smooth deep-toned gradient background. ' +
      'Palette is deep indigo and slate with cool light accents and white text. ' +
      'Illustration mode is minimal flat vector icons and simple data shapes inside ' +
      'the tiles. Typography is clean modern sans-serif, one large headline tile ' +
      'and short labels elsewhere. ' +
      SHARED_NO_LIST,
  },
  {
    id: 'cartoon-mascot',
    label: 'Cartoon mascot',
    cliStyle: 'instructional',
    descriptor:
      'VISUAL STYLE: friendly cartoon-mascot explainer. A single simple, rounded, ' +
      'flat-vector mascot character guides the reader through numbered sections, ' +
      'each opened by a bold circular numbered badge, with one or two "DID YOU ' +
      'KNOW?" callout boxes and a cited-sources line at the foot. Background is ' +
      'light and clean. Palette is bright but limited — a primary blue, a warm ' +
      'accent, white panels and dark text — all flat fills with no gradients. ' +
      'Illustration mode is simple flat cartoon vector with thick friendly ' +
      'outlines and no realistic detail. Typography is rounded, approachable ' +
      'sans-serif with clear hierarchy. The mascot is the ONLY cartoon element; ' +
      'everything else stays clean and flat. ' +
      SHARED_NO_LIST,
  },
] as const;

export function findInfographicStyle(
  styleId: string,
): InfographicStyle | undefined {
  return INFOGRAPHIC_STYLES.find((s) => s.id === styleId);
}
