/**
 * Props for the product-demo format — the first template built around
 * operator-supplied media rather than generated market data.
 *
 * The two aspect ratios share ONE authored content spine (a hook, ordered
 * features, a CTA) but not one timing: a 25-second vertical and a 90-second
 * horizontal are different edits of the same material, not crops of each
 * other. The vertical takes the first callout per feature; the horizontal
 * uses the fuller set. Same authoring, different depth.
 */
import { z } from "zod";
import { MediaSlotSchema } from "./media-slot";

/**
 * How the opening line is delivered. A per-video choice, because a
 * synthetic presenter and a typographic hook suit different messages — and
 * an avatar costs money per clip while a text card does not.
 */
export const ProductDemoHookSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("avatar_video"),
      /** The generated clip. Carries its own baked audio. */
      slot: MediaSlotSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("text_card"),
      headline: z.string().min(1).max(90),
      subhead: z.string().max(120).optional(),
    })
    .strict(),
]);

export type ProductDemoHook = z.infer<typeof ProductDemoHookSchema>;

export const ProductDemoFeatureSchema = z
  .object({
    /** Stable id so capture and copy can address the same feature. */
    key: z.string().min(1),
    title: z.string().min(1).max(60),
    /**
     * Shown over the footage, in order. The vertical cut takes only the
     * first — a phone frame cannot hold three labels and stay readable.
     */
    callouts: z.array(z.string().min(1).max(80)).min(1).max(3),
    /** The screenshot or clip for this beat. */
    slot: MediaSlotSchema,
    /**
     * Where each callout points, normalized to the frame. Defaults to a
     * sensible stack when omitted.
     */
    calloutAnchors: z
      .array(
        z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
      )
      .optional(),
  })
  .strict();

export type ProductDemoFeature = z.infer<typeof ProductDemoFeatureSchema>;

export const ProductDemoShape = {
  hook: ProductDemoHookSchema,
  features: z.array(ProductDemoFeatureSchema).min(1).max(6),
  /** Closing line under the brand card. */
  ctaHeadline: z.string().max(70).optional(),
} as const;
