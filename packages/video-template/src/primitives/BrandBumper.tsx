import React from "react";
import {
  AbsoluteFill,
  Img,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  staticFile,
  interpolate,
} from "remotion";
import { useLayoutConfig } from "../layout/useLayoutConfig";

/**
 * 2-second opening brand sting. On the brand indigo background, the
 * shortmark pops in (spring) and the PropertyIQ wordmark fades in
 * beneath it after a short delay. Audio sting plays from
 * /public/brand-sting.mp3.
 *
 * Assets live in /public/brand/ (shipped via Remotion's staticFile()):
 *   - piq-shortmark-192px-normal.png — the square PIQ icon + dots
 *   - piq-logo-primary-dark-reversed.png — "PropertyIQ / The IQ Behind
 *     Every Market" wordmark in light colors, meant for dark backgrounds
 */
export const BrandBumper: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();

  // Shortmark pops in immediately via spring.
  const shortmarkSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 140 },
    durationInFrames: 20,
  });

  // Wordmark fades in after the shortmark settles.
  const wordmarkOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const shortmarkSize = 260 * scale;
  const wordmarkWidth = 520 * scale;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1A237E",
        justifyContent: "center",
        alignItems: "center",
        gap: 40 * scale,
      }}
    >
      <Audio src={staticFile("brand-sting.mp3")} />
      <Img
        src={staticFile("brand/piq-shortmark-192px-normal.png")}
        style={{
          width: shortmarkSize,
          height: shortmarkSize,
          objectFit: "contain",
          transform: `scale(${shortmarkSpring})`,
        }}
      />
      <Img
        src={staticFile("brand/piq-logo-primary-dark-reversed.png")}
        style={{
          width: wordmarkWidth,
          height: "auto",
          objectFit: "contain",
          opacity: wordmarkOpacity,
        }}
      />
    </AbsoluteFill>
  );
};
