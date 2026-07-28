/**
 * The product-demo format: two ratios over one authored spine.
 *
 * The first template driven by operator-supplied media rather than market
 * data, and the reason media slots exist. Kept out of manifest.ts so that
 * file stays a readable catalogue and both stay inside the size limit.
 */
import type {
  CopyFieldDeclaration,
  FormatManifestEntry,
  MediaSlotDeclaration,
  WizardStep,
} from "./manifest-types";

/**
 * Write the words, drop in the screens, watch it, ship it. No market step —
 * this format is about the product, not a market, which is why its
 * dataSource is "none".
 */
const PRODUCT_DEMO_STEPS: WizardStep[] = [
  { type: "copy", title: "Write the hook and features" },
  { type: "media", title: "Add your screens" },
  { type: "preview", title: "Preview" },
  { type: "confirm", title: "Confirm" },
];

const PRODUCT_DEMO_COPY: CopyFieldDeclaration[] = [
  {
    fieldId: "hookHeadline",
    label: "Hook",
    // Has to land in the first ~3 seconds; anything longer cannot be read
    // and spoken inside that window.
    maxLength: 90,
    // The one line worth shopping — generated as alternatives to pick from.
    variants: 3,
  },
  {
    fieldId: "featureTitle",
    label: "Feature title",
    maxLength: 60,
    repeating: true,
  },
  {
    fieldId: "featureCallout",
    label: "Callout",
    maxLength: 80,
    repeating: true,
  },
  { fieldId: "ctaHeadline", label: "Closing line", maxLength: 70 },
];

const PRODUCT_DEMO_SLOTS: MediaSlotDeclaration[] = [
  {
    slotId: "hookClip",
    label: "Hook clip (optional)",
    kind: "video",
    required: false,
    helpText:
      "An avatar/presenter clip. Leave empty to use an animated text hook.",
  },
  {
    slotId: "feature1",
    label: "Feature 1 screen",
    kind: "image",
    required: true,
    helpText:
      "Screenshot at 1920x1080. Auto-captured from the live site when available.",
  },
  {
    slotId: "feature2",
    label: "Feature 2 screen",
    kind: "image",
    required: false,
  },
  {
    slotId: "feature3",
    label: "Feature 3 screen",
    kind: "image",
    required: false,
  },
];

function productDemo(
  key: "product_demo_horizontal" | "product_demo_vertical",
): FormatManifestEntry {
  const vertical = key === "product_demo_vertical";
  return {
    key,
    displayName: vertical ? "Product Demo (Vertical)" : "Product Demo",
    audience: "Agents, investors evaluating the product",
    purpose: vertical
      ? "Short social cut: hook, three features, CTA."
      : "Landing-page explainer walking through the product.",
    width: vertical ? 1080 : 1920,
    height: vertical ? 1920 : 1080,
    fps: 30,
    // calculateMetadata derives the real length from the feature count;
    // this is the catalogue default for Studio preview.
    durationInFrames: vertical ? 750 : 2250,
    targetSeconds: vertical ? 25 : 75,
    beats: vertical
      ? // Completion rate is the ranking signal on short-form and falls off
        // hard past ~30s. Six seconds per feature is one clear idea.
        { hookSec: 3, perItemSec: 6, ctaSec: 4 }
      : // Long enough to actually explain, short enough to finish.
        { hookSec: 5, perItemSec: 20, ctaSec: 8 },
    openWithBumper: false,
    dataSource: "none",
    mediaSlots: PRODUCT_DEMO_SLOTS,
    copyFields: PRODUCT_DEMO_COPY,
    thumbnail: {
      layout: "product",
      copyFields: [
        {
          fieldId: "thumbnailHeadline",
          label: "Thumbnail headline",
          maxLength: 28,
        },
      ],
    },
    steps: PRODUCT_DEMO_STEPS,
  };
}

export const PRODUCT_DEMO_HORIZONTAL = productDemo("product_demo_horizontal");
export const PRODUCT_DEMO_VERTICAL = productDemo("product_demo_vertical");

export type ProductDemoFormatKey =
  | "product_demo_horizontal"
  | "product_demo_vertical";

/** True for the two product-demo keys — used to route props and layouts. */
export function isProductDemoFormat(key: string): key is ProductDemoFormatKey {
  return key === "product_demo_horizontal" || key === "product_demo_vertical";
}
