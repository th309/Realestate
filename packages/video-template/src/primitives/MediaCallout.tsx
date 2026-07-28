import React from "react";
import { useVideoConfig } from "remotion";
import { AnimatedEntrance } from "../motion";
import { useLayoutConfig } from "../layout/useLayoutConfig";
import {
  BORDER_WIDTH,
  FONTS,
  PALETTE,
  brandBorder,
  brandFill,
  withAlpha,
} from "../styles/tokens";

export interface MediaCalloutProps {
  /** The label. Keep it to a few words — this is read at a glance. */
  text: string;
  /** Anchor point in the frame, normalized 0-1. */
  at: { x: number; y: number };
  /** Sibling position, for the house 4-frame stagger. */
  index?: number;
  /** Extra frames before the entrance. */
  delay?: number;
}

/** Approximate label width used for edge-flipping, as a fraction of frame width. */
const LABEL_WIDTH_FRACTION = 0.46;

/**
 * A labeled annotation pinned to a point on the media beneath it: a dot at
 * the anchor, a short connector, and a pill carrying the words.
 *
 * Placement is clamped inside the platform safe zone, so a callout can
 * never end up under TikTok's action rail or caption block — the most
 * common way an otherwise good frame becomes unreadable in the app.
 */
export const MediaCallout: React.FC<MediaCalloutProps> = ({
  text,
  at,
  index = 0,
  delay = 0,
}) => {
  const { width, height } = useVideoConfig();
  const { scale, safeZone } = useLayoutConfig();

  const anchorX = clamp(at.x * width, safeZone.left, width - safeZone.right);
  const anchorY = clamp(at.y * height, safeZone.top, height - safeZone.bottom);

  // Flip the label to the anchor's left when there isn't room on the right.
  const labelWidth = width * LABEL_WIDTH_FRACTION;
  const flip = anchorX + labelWidth > width - safeZone.right;

  const dotSize = 18 * scale;
  const connector = 56 * scale;

  return (
    <AnimatedEntrance
      index={index}
      delay={delay}
      from={flip ? "right" : "left"}
      distance={28}
      style={{
        position: "absolute",
        left: anchorX,
        top: anchorY,
        // Anchor sits at the dot's centre regardless of which way it flips.
        transform: `translate(${flip ? "-100%" : "0"}, -50%)`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: flip ? "row-reverse" : "row",
          alignItems: "center",
          gap: 0,
        }}
      >
        <div
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: "50%",
            background: PALETTE.warning,
            boxShadow: `0 0 ${18 * scale}px ${withAlpha(PALETTE.warning, 0.7)}`,
            flexShrink: 0,
          }}
        />
        <div
          style={{
            width: connector,
            height: BORDER_WIDTH,
            background: PALETTE.warning,
            flexShrink: 0,
          }}
        />
        <div
          style={{
            background: brandFill(PALETTE.indigoMedium),
            border: brandBorder(PALETTE.indigoMedium),
            backdropFilter: "blur(8px)",
            borderRadius: 999,
            padding: `${14 * scale}px ${26 * scale}px`,
            fontFamily: FONTS.body,
            fontWeight: 700,
            fontSize: 34 * scale,
            color: PALETTE.surface,
            whiteSpace: "nowrap",
            textShadow: `0 2px 8px ${withAlpha(PALETTE.stageDeep, 0.9)}`,
          }}
        >
          {text}
        </div>
      </div>
    </AnimatedEntrance>
  );
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
