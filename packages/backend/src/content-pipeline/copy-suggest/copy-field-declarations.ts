/**
 * Backend mirror of the copy-field declarations each format publishes in
 * packages/video-template/src/formats.
 *
 * Mirrored rather than imported, and the reason was verified rather than
 * assumed. The backend compiles with `moduleResolution: "node"`, which does
 * not read a package `exports` map, so `@propertyiq/video-template/formats`
 * does not resolve at all (tsc names the setting in the error). The one
 * specifier that does resolve reaches into `dist/`, and `npm run build:backend`
 * runs `build:libs`, which builds analyzer-core and emails but NOT
 * video-template. A compile-time dependency on that build artifact would
 * therefore break the Railway backend build on any clean checkout, to buy a
 * table of four constants.
 *
 * This follows format-durations.ts, which mirrors the same package's duration
 * table and explains the same tradeoff. Keep this file in sync when a format
 * gains or changes a copy field.
 */

/** Mirrors `CopyFieldDeclaration` in video-template's formats/manifest-types. */
export interface CopyFieldDeclaration {
  fieldId: string;
  label: string;
  maxLength: number;
  /** Ask for this many alternatives instead of one. */
  variants?: number;
  /** One value per item in the ordered feature list, rather than a single value. */
  repeating?: boolean;
}

/** Mirrors PRODUCT_DEMO_COPY in formats/product-demo-format.ts. */
const PRODUCT_DEMO_COPY: CopyFieldDeclaration[] = [
  { fieldId: 'hookHeadline', label: 'Hook', maxLength: 90, variants: 3 },
  {
    fieldId: 'featureTitle',
    label: 'Feature title',
    maxLength: 60,
    repeating: true,
  },
  {
    fieldId: 'featureCallout',
    label: 'Callout',
    maxLength: 80,
    repeating: true,
  },
  { fieldId: 'ctaHeadline', label: 'Closing line', maxLength: 70 },
];

/**
 * Only the operator-authored formats appear here. Every market-data format
 * declares `copyFields: []` in the manifest because its words come from the
 * script generator, not from a person typing — asking for a draft is a
 * category error, so those keys are absent and the service rejects them.
 */
export const COPY_FIELDS_BY_FORMAT: Record<string, CopyFieldDeclaration[]> = {
  product_demo_horizontal: PRODUCT_DEMO_COPY,
  product_demo_vertical: PRODUCT_DEMO_COPY,
};

export const COPY_SUGGEST_FORMAT_KEYS = Object.keys(COPY_FIELDS_BY_FORMAT);

export function getCopyFieldsForFormat(
  formatKey: string,
): CopyFieldDeclaration[] | undefined {
  return COPY_FIELDS_BY_FORMAT[formatKey];
}

/**
 * How many values a field wants. Repeating wins over variants when a field
 * somehow declares both: the feature list has a real length the video renders
 * against, whereas variants are only a menu to pick from.
 */
export function valueCountForField(
  field: CopyFieldDeclaration,
  itemCount: number,
): number {
  if (field.repeating) return itemCount;
  return field.variants ?? 1;
}

/** True when the field's value is an array in the response rather than a string. */
export function fieldIsMultiValued(field: CopyFieldDeclaration): boolean {
  return Boolean(field.repeating) || (field.variants ?? 1) > 1;
}
