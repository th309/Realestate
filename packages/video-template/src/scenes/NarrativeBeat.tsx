import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { COLORS } from "../constants";
import { LONG_FORM_VISUAL_RHYTHM_FRAMES } from "../constants/long-form-rhythm";
import { useLayoutConfig } from "../layout/useLayoutConfig";
import { MeshBackground } from "../primitives/MeshBackground";
import { NarrativeSideArt } from "../primitives/NarrativeSideArt";

export interface NarrativeBeatProps {
  market: string;
  title: string;
  excerpt: string;
}

const GRADIENTS = [
  `radial-gradient(ellipse at 30% 20%, rgba(57,73,171,0.38) 0%, ${COLORS.bg} 55%)`,
  `radial-gradient(ellipse at 72% 24%, rgba(57,73,171,0.45) 0%, ${COLORS.bg} 58%)`,
  `linear-gradient(128deg, rgba(26,35,126,0.5) 0%, ${COLORS.bg} 48%, rgba(0,200,83,0.1) 100%)`,
] as const;

/**
 * Long-form chapter overlay. Cycles layout/art every LONG_FORM_VISUAL_RHYTHM_FRAMES
 * so a long voice track is not one static card.
 */
export const NarrativeBeat: React.FC<NarrativeBeatProps> = ({
  market,
  title,
  excerpt,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  const opacity = interpolate(frame, [0, 14], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const phase = Math.floor(frame / LONG_FORM_VISUAL_RHYTHM_FRAMES) % 3;
  const showSide = phase !== 0;
  const artVariant: 0 | 1 = phase === 1 ? 0 : 1;

  const titleSize = isVertical ? 38 : 30;
  const bodySize = isVertical ? 26 : 20;
  const tagSize = isVertical ? 20 : 15;

  const trimmed =
    excerpt.length > 560 ? `${excerpt.slice(0, 557).trim()}…` : excerpt;

  const main = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: 20,
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: tagSize,
          fontWeight: 700,
          color: COLORS.accent,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        {market}
      </div>
      <div
        style={{
          fontSize: titleSize,
          fontWeight: 800,
          color: COLORS.text,
          lineHeight: 1.15,
          maxWidth: "98%",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: bodySize,
          fontWeight: 400,
          color: COLORS.textMuted,
          lineHeight: 1.45,
          maxWidth: phase === 2 ? "94%" : "96%",
          whiteSpace: "pre-wrap",
          borderLeft:
            phase === 2 ? `4px solid rgba(57,73,171,0.65)` : undefined,
          paddingLeft: phase === 2 ? 20 : 0,
        }}
      >
        {trimmed}
      </div>
    </div>
  );

  return (
    <div
      style={{
        width,
        height,
        background: GRADIENTS[phase],
        display: "flex",
        flexDirection:
          showSide && isVertical ? "column" : showSide ? "row" : "column",
        alignItems: showSide && !isVertical ? "stretch" : "flex-start",
        justifyContent: "center",
        fontFamily: "Roboto, 'Segoe UI', sans-serif",
        opacity,
        padding: isVertical ? "56px 52px" : "48px 96px",
        boxSizing: "border-box",
        gap: showSide ? (isVertical ? 28 : 44) : 20,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <MeshBackground />

      {!isVertical && showSide && (
        <div
          style={{
            flex: "0 0 36%",
            maxWidth: 440,
            minHeight: 280,
            position: "relative",
            zIndex: 1,
            opacity: interpolate(frame % LONG_FORM_VISUAL_RHYTHM_FRAMES, [0, 14], [0.75, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <NarrativeSideArt variant={artVariant} frame={frame} />
        </div>
      )}

      {isVertical && showSide && (
        <div style={{ width: "100%", height: 200, position: "relative", zIndex: 1 }}>
          <NarrativeSideArt variant={artVariant} frame={frame} />
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, flex: 1, width: "100%" }}>
        {main}
      </div>
    </div>
  );
};
