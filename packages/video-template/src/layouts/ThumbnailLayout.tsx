import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { MeshBackground } from "../primitives/MeshBackground";
import { ScoreRing } from "../primitives/ScoreRing";
import { useLayoutConfig } from "../layout/useLayoutConfig";
import { VideoLayout } from "../layout/VideoLayout";
import { FORMAT_CONFIGS, type FormatKey } from "../formats/manifest";
import {
  BORDER_WIDTH,
  FONTS,
  NUMERIC,
  PALETTE,
  brandBorder,
  brandFill,
} from "../styles/tokens";

export interface ThumbnailLayoutProps {
  /**
   * The format this thumbnail belongs to.
   *
   * Thumbnails register as standalone compositions rather than inside
   * PropertyIQVideo, so they have to supply their own layout context —
   * scale and safe zones don't exist otherwise.
   */
  formatKey: FormatKey;
  /** Which treatment to draw — comes from the format's manifest entry. */
  variant: "score" | "ranking" | "delta" | "versus" | "editorial" | "product";
  /** 3-5 words. Anything longer is unreadable at the size this is viewed. */
  headline: string;
  /** The one number worth showing, when the variant has one. */
  score?: number;
  /** Optional supporting line — a market name, a metric label. */
  eyebrow?: string;
}

/**
 * A designed thumbnail, not a grabbed frame.
 *
 * The pipeline used to pull frame 210 of the video and call it a thumbnail.
 * A frame lifted out of motion is almost always the wrong image: mid-word,
 * mid-gesture, text half-animated, composition accidental. For YouTube the
 * thumbnail is roughly half the click decision, so that was real lost reach.
 *
 * Everything here is sized for the actual viewing condition — about 120px
 * wide in a feed. That means very few words, very large, one focal element,
 * and no more than two type sizes.
 */
export const ThumbnailLayout: React.FC<ThumbnailLayoutProps> = ({
  formatKey,
  ...rest
}) => (
  <VideoLayout config={FORMAT_CONFIGS[formatKey]}>
    <ThumbnailArt {...rest} />
  </VideoLayout>
);

const ThumbnailArt: React.FC<Omit<ThumbnailLayoutProps, "formatKey">> = ({
  variant,
  headline,
  score,
  eyebrow,
}) => {
  const { scale, isVertical } = useLayoutConfig();

  // Deliberately enormous. At feed size this reads; anything "tasteful"
  // disappears.
  const headlineSize = (isVertical ? 132 : 150) * scale;
  const eyebrowSize = (isVertical ? 34 : 30) * scale;
  const showRing = typeof score === "number" && variant !== "product";

  return (
    <AbsoluteFill>
      <MeshBackground />
      <AbsoluteFill
        style={{
          padding: `${72 * scale}px ${84 * scale}px`,
          justifyContent: "center",
          gap: 28 * scale,
        }}
      >
        {eyebrow && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16 * scale,
            }}
          >
            <div
              style={{
                width: 52 * scale,
                height: BORDER_WIDTH * 2,
                background: PALETTE.warning,
              }}
            />
            <span
              style={{
                fontFamily: FONTS.body,
                fontWeight: 700,
                fontSize: eyebrowSize,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: PALETTE.warning,
              }}
            >
              {eyebrow}
            </span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 48 * scale,
          }}
        >
          <div
            style={{
              flex: 1,
              fontFamily: FONTS.display,
              fontWeight: 800,
              fontSize: headlineSize,
              lineHeight: 0.94,
              letterSpacing: "-0.04em",
              color: PALETTE.surface,
            }}
          >
            {headline}
          </div>

          {/* The brand's signature dial, which still reads at feed size. */}
          {showRing && (
            <div style={{ flexShrink: 0 }}>
              <ScoreRing score={score} size={340 * scale} delay={0} animate={false} />
            </div>
          )}
        </div>

        {/* Small, bottom-left: identifies the source without competing. */}
        <div
          style={{
            position: "absolute",
            left: 84 * scale,
            bottom: 64 * scale,
            display: "flex",
            alignItems: "center",
            gap: 14 * scale,
            padding: `${10 * scale}px ${20 * scale}px`,
            borderRadius: 999,
            background: brandFill(PALETTE.indigoMedium),
            border: brandBorder(PALETTE.indigoMedium),
          }}
        >
          <Img
            src={staticFile("brand/piq-shortmark-192px-normal.png")}
            style={{ width: 40 * scale, height: 40 * scale }}
          />
          <span
            style={{
              fontFamily: FONTS.mono,
              fontWeight: 500,
              fontSize: 28 * scale,
              color: PALETTE.surface,
              ...NUMERIC,
            }}
          >
            propertyiq.app
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
