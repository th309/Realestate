import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

interface HookHeadlineProps {
  headline: string;
  scope: string;
  accent: string;
}

/**
 * Hook scene shown during the audio's intro (everything before the narrator
 * says "Number N."). Editorial framing — Roboto Black at display size with
 * tight letter-spacing, plus a hairline rule grounding the typography.
 *
 * Used only by Top10Layout's hook window; not a generic primitive.
 */
export const HookHeadline: React.FC<HookHeadlineProps> = ({
  headline,
  scope,
  accent,
}) => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 18], [40, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: "0 80px",
      }}
    >
      <div
        style={{
          fontFamily: "'Roboto Mono', monospace",
          fontWeight: 600,
          fontSize: 28,
          letterSpacing: "0.32em",
          color: accent,
          textTransform: "uppercase",
          opacity,
          transform: `translateY(${rise}px)`,
        }}
      >
        Countdown
      </div>
      <div
        style={{
          fontFamily: "'Roboto', sans-serif",
          fontWeight: 900,
          fontSize: 156,
          letterSpacing: "-0.05em",
          lineHeight: 0.95,
          color: "#FFFFFF",
          textAlign: "center",
          opacity,
          transform: `translateY(${rise}px)`,
        }}
      >
        {headline}
      </div>
      <div
        style={{
          height: 2,
          width: 320,
          backgroundColor: "#5C6BC0",
          opacity,
        }}
      />
      <div
        style={{
          fontFamily: "'Roboto Mono', monospace",
          fontWeight: 500,
          fontSize: 32,
          letterSpacing: "0.18em",
          color: "#C5CAE9",
          textTransform: "uppercase",
          opacity,
        }}
      >
        {scope}
      </div>
    </AbsoluteFill>
  );
};
