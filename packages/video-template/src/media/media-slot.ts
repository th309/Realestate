/**
 * Media slots — the contract for operator-supplied images and video.
 *
 * Every format before this was 100% generated from market data: there was
 * nowhere to hand a template a screenshot or a clip, which is why a product
 * explainer couldn't be built at all. A slot is a named hole in a
 * composition that a run fills with a real asset.
 *
 * Lives in its own module (not types.ts) so the props contract can grow
 * without pushing that file back over the line limit.
 */
import { z } from "zod";

/**
 * A rectangle within the SOURCE asset, normalized 0-1.
 *
 * This is what makes a UI screenshot watchable. Panning slowly across a
 * whole dashboard is unreadable on a phone; punching in to the one element
 * being talked about is not. Coordinates are relative to the asset, not the
 * frame, so the same slot works in both aspect ratios.
 */
export const FocusRegionSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0.01).max(1),
    h: z.number().min(0.01).max(1),
  })
  .strict();

export type FocusRegion = z.infer<typeof FocusRegionSchema>;

export const MediaSlotSchema = z
  .object({
    /** Matches the slotId the format declares. */
    slotId: z.string().min(1),
    kind: z.enum(["image", "video"]),
    url: z.string().url(),
    /** Where to punch in. Omit for a gentle full-frame drift. */
    focusRegion: FocusRegionSchema.optional(),
    /**
     * The asset's own width/height ratio.
     *
     * Required to place a focusRegion correctly: the region is authored
     * against the SOURCE (an operator drags a box on their screenshot), so
     * mapping it onto a differently-shaped frame needs the source's shape.
     * Without it a 16:9 screenshot in a 9:16 frame lands the region
     * somewhere else entirely — usually cropped off-screen.
     */
    sourceAspect: z.number().positive().optional(),
    /** Dim everything outside the focus region while punching in. */
    spotlight: z.boolean().optional(),
    /** Trim points for video slots, in ms from the asset's start. */
    trimMs: z
      .object({
        start: z.number().min(0),
        end: z.number().min(0),
      })
      .strict()
      .optional(),
  })
  .strict();

export type MediaSlotValue = z.infer<typeof MediaSlotSchema>;

/** Pick a slot by id — formats address slots by name, not position. */
export function findSlot(
  slots: readonly MediaSlotValue[] | undefined,
  slotId: string,
): MediaSlotValue | undefined {
  return slots?.find((s) => s.slotId === slotId);
}

export interface PunchInGeometry {
  /** Layout size of the asset element, before the transform. */
  boxWidth: number;
  boxHeight: number;
  scale: number;
  translateX: number;
  translateY: number;
  /** Where the focus region currently sits on screen (the spotlight needs it). */
  regionOnScreen: { left: number; top: number; width: number; height: number };
}

/**
 * Geometry for a punch-in at a given progress (0 → 1).
 *
 * The shot establishes on the whole asset and pushes in until the focus
 * region is as large as it can be while still fully visible. Both ends are
 * "contain", not "cover", deliberately: a wide, short UI element cannot
 * fill a 9:16 frame without cropping its own sides off, and a half-visible
 * stat block is worse than a smaller whole one.
 *
 * `sourceAspect` (width/height) is what makes the region land in the right
 * place — the region is authored against the source asset, so without its
 * shape there is no way to map it onto a differently-shaped frame. Omitting
 * it assumes the asset already matches the frame.
 *
 * Pure, so the math is unit-testable without rendering a frame.
 */
export function punchInGeometry(
  region: FocusRegion | undefined,
  progress: number,
  frameWidth: number,
  frameHeight: number,
  options: { sourceAspect?: number; restScale?: number } = {},
): PunchInGeometry {
  const { sourceAspect, restScale = 1.06 } = options;

  // Lay the asset out at its own shape so region coordinates stay linear.
  const boxWidth = frameWidth;
  const boxHeight = sourceAspect ? frameWidth / sourceAspect : frameHeight;

  // Establish: the whole asset visible.
  const startScale = Math.min(frameWidth / boxWidth, frameHeight / boxHeight);

  const target = region ?? { x: 0, y: 0, w: 1, h: 1 };
  const endScale = region
    ? Math.min(
        frameWidth / (target.w * boxWidth),
        frameHeight / (target.h * boxHeight),
      )
    : startScale * restScale;

  const scale = startScale + (endScale - startScale) * progress;

  // Centre travels from the asset's middle to the region's middle.
  const cx = 0.5 + (target.x + target.w / 2 - 0.5) * progress;
  const cy = 0.5 + (target.y + target.h / 2 - 0.5) * progress;

  const translateX = frameWidth / 2 - scale * cx * boxWidth;
  const translateY = frameHeight / 2 - scale * cy * boxHeight;

  return {
    boxWidth,
    boxHeight,
    scale,
    translateX,
    translateY,
    regionOnScreen: {
      left: translateX + scale * target.x * boxWidth,
      top: translateY + scale * target.y * boxHeight,
      width: scale * target.w * boxWidth,
      height: scale * target.h * boxHeight,
    },
  };
}
