import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { COLORS } from "../constants";
import { useLayoutConfig } from "../layout/useLayoutConfig";

interface OutroProps {
  ctaUrl: string;
  ctaLabel?: string;
  marketName?: string;
}

export const Outro: React.FC<OutroProps> = ({ ctaUrl, ctaLabel }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  const sceneOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Logo pop
  const logoSpring = spring({
    fps,
    frame,
    config: { damping: 14, stiffness: 120 },
    durationInFrames: 30,
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Text stagger
  const line1Opacity = interpolate(frame, [20, 45], [0, 1], {
    easing: Easing.ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line2Opacity = interpolate(frame, [40, 65], [0, 1], {
    easing: Easing.ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaOpacity = interpolate(frame, [60, 90], [0, 1], {
    easing: Easing.ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subscribeOpacity = interpolate(frame, [80, 110], [0, 1], {
    easing: Easing.ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Final fade hold — fade out last 20 frames
  const finalFade = interpolate(frame, [190, 210], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoSize = isVertical ? 80 : 60;
  const brandSize = isVertical ? 72 : 52;
  const taglineSize = isVertical ? 36 : 26;
  const ctaSize = isVertical ? 32 : 24;
  const urlSize = isVertical ? 36 : 28;
  const subscribeSize = isVertical ? 28 : 20;

  return (
    <div
      style={{
        width,
        height,
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        opacity: sceneOpacity * finalFade,
        gap: isVertical ? 40 : 32,
        padding: isVertical ? "0 80px" : "0 160px",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: logoSize * 2,
          height: logoSize * 2,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${COLORS.accent}, #6366f1)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 80px ${COLORS.accentGlow}`,
          transform: `scale(${logoScale})`,
        }}
      >
        <span
          style={{
            color: COLORS.text,
            fontWeight: 800,
            fontSize: logoSize * 0.9,
            letterSpacing: "-2px",
          }}
        >
          IQ
        </span>
      </div>

      {/* Brand name */}
      <div style={{ opacity: line1Opacity }}>
        <span
          style={{
            fontSize: brandSize,
            fontWeight: 800,
            color: COLORS.text,
            letterSpacing: "-1px",
          }}
        >
          Property<span style={{ color: COLORS.accent }}>IQ</span>
        </span>
      </div>

      {/* Tagline */}
      <div style={{ opacity: line2Opacity }}>
        <span
          style={{
            fontSize: taglineSize,
            fontWeight: 400,
            color: COLORS.textMuted,
            letterSpacing: "0.02em",
          }}
        >
          Score real estate markets. Stop guessing. Start deciding.
        </span>
      </div>

      {/* Divider */}
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          height: 1,
          background: `linear-gradient(to right, transparent, ${COLORS.bgCardAlt}, transparent)`,
          opacity: ctaOpacity,
        }}
      />

      {/* CTA */}
      <div
        style={{
          opacity: ctaOpacity,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: ctaSize,
            color: COLORS.textMuted,
            fontWeight: 400,
          }}
        >
          {ctaLabel ?? "Explore 400+ scored markets at"}
        </div>
        <div
          style={{
            fontSize: urlSize,
            fontWeight: 700,
            color: COLORS.accent,
            letterSpacing: "0.02em",
            background: `${COLORS.accent}15`,
            border: `1px solid ${COLORS.accent}40`,
            borderRadius: 12,
            padding: isVertical ? "16px 40px" : "12px 32px",
          }}
        >
          propertyiq.app
        </div>
        <div
          style={{
            fontSize: isVertical ? 20 : 14,
            color: COLORS.textDim,
            wordBreak: "break-all",
          }}
        >
          {ctaUrl}
        </div>
      </div>

      {/* Subscribe prompt */}
      <div
        style={{
          opacity: subscribeOpacity,
          fontSize: subscribeSize,
          color: COLORS.textDim,
          fontStyle: "italic",
        }}
      >
        Subscribe for weekly market scores.
      </div>
    </div>
  );
};
