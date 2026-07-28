import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../constants";
import { LONG_FORM_VISUAL_RHYTHM_FRAMES } from "../constants/long-form-rhythm";
import { AnimatedEntrance, EASINGS } from "../motion";
import { FONTS, PALETTE, brandBorder, withAlpha } from "../styles/tokens";
import { useLayoutConfig } from "../layout/useLayoutConfig";
import { MeshBackground } from "../primitives/MeshBackground";
import { NarrativeSideArt } from "../primitives/NarrativeSideArt";

export interface NarrativeBeatProps {
  market: string;
  title: string;
  excerpt: string;
}

/**
 * Per-phase brand wash layered OVER the mesh — the phase change is what keeps
 * a long chapter read from looking like one static card.
 */
const PHASE_WASHES = [
  `radial-gradient(ellipse at 30% 20%, ${withAlpha(PALETTE.indigo, 0.38)} 0%, transparent 55%)`,
  `radial-gradient(ellipse at 72% 24%, ${withAlpha(PALETTE.indigo, 0.45)} 0%, transparent 58%)`,
  `linear-gradient(128deg, ${withAlpha(PALETTE.indigoDark, 0.5)} 0%, transparent 48%, ${withAlpha(PALETTE.positive, 0.1)} 100%)`,
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

  const phase = Math.floor(frame / LONG_FORM_VISUAL_RHYTHM_FRAMES) % 3;
  const showSide = phase !== 0;
  const artVariant: 0 | 1 = phase === 1 ? 0 : 1;

  // Scripted re-settle at each phase boundary — the art brightens back in.
  const artOpacity = interpolate(
    frame % LONG_FORM_VISUAL_RHYTHM_FRAMES,
    [0, 14],
    [0.75, 1],
    {
      easing: EASINGS.standard,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

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
      <AnimatedEntrance index={0} from="left" distance={28}>
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
      </AnimatedEntrance>
      <AnimatedEntrance index={1} from="rise" distance={26}>
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
      </AnimatedEntrance>
      <AnimatedEntrance index={2} from="rise" preset="gentle" distance={20}>
        <div
          style={{
            fontSize: bodySize,
            fontWeight: 400,
            color: COLORS.textMuted,
            lineHeight: 1.45,
            maxWidth: phase === 2 ? "94%" : "96%",
            whiteSpace: "pre-wrap",
            borderLeft:
              phase === 2 ? brandBorder(PALETTE.indigo, 0.65) : undefined,
            paddingLeft: phase === 2 ? 20 : 0,
          }}
        >
          {trimmed}
        </div>
      </AnimatedEntrance>
    </div>
  );

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection:
          showSide && isVertical ? "column" : showSide ? "row" : "column",
        alignItems: showSide && !isVertical ? "stretch" : "flex-start",
        justifyContent: "center",
        fontFamily: FONTS.body,
        padding: isVertical ? "56px 52px" : "48px 96px",
        boxSizing: "border-box",
        gap: showSide ? (isVertical ? 28 : 44) : 20,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.55 }}>
        <MeshBackground />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background: PHASE_WASHES[phase],
        }}
      />

      {!isVertical && showSide && (
        <div
          style={{
            flex: "0 0 36%",
            maxWidth: 440,
            minHeight: 280,
            position: "relative",
            zIndex: 1,
            opacity: artOpacity,
          }}
        >
          <NarrativeSideArt variant={artVariant} frame={frame} />
        </div>
      )}

      {isVertical && showSide && (
        <div
          style={{
            width: "100%",
            height: 200,
            position: "relative",
            zIndex: 1,
            opacity: artOpacity,
          }}
        >
          <NarrativeSideArt variant={artVariant} frame={frame} />
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, flex: 1, width: "100%" }}>
        {main}
      </div>
    </div>
  );
};
