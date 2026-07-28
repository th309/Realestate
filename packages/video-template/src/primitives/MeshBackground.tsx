import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTE, withAlpha } from "../styles/tokens";

/**
 * Slow-drifting indigo gradient with a faint grid overlay. Replaces the dead
 * #1A1A2E fill with atmosphere: two radial blooms (one indigo, one near-black)
 * that drift on opposite axes over the entire composition. Subtle enough that
 * it never competes with foreground content; lively enough that empty frames
 * never feel static.
 *
 * Drift uses currentFrame / fps so the motion is real-time-stable across
 * different composition durations.
 */
export const MeshBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const seconds = frame / fps;

  // Two slow oscillators — full cycle ~30s — keeps motion organic, not loopy.
  const driftA = 0.5 + 0.5 * Math.sin((seconds * Math.PI * 2) / 30);
  const driftB = 0.5 + 0.5 * Math.cos((seconds * Math.PI * 2) / 22);

  const blobAX = 30 + driftA * 40; // 30%–70%
  const blobAY = 20 + driftB * 30; // 20%–50%
  const blobBX = 70 - driftA * 30; // 40%–70%
  const blobBY = 70 + driftB * 20; // 70%–90%

  return (
    <AbsoluteFill
      style={{ overflow: "hidden", backgroundColor: PALETTE.stageDeep }}
    >
      {/* Indigo bloom — primary atmosphere layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(
            ellipse 70% 55% at ${blobAX}% ${blobAY}%,
            ${withAlpha(PALETTE.indigo, 0.55)} 0%,
            ${withAlpha(PALETTE.indigo, 0.12)} 40%,
            transparent 70%
          )`,
        }}
      />
      {/* Deep-violet counter-bloom for depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(
            ellipse 60% 45% at ${blobBX}% ${blobBY}%,
            ${withAlpha(PALETTE.indigoDark, 0.65)} 0%,
            ${withAlpha(PALETTE.indigoDark, 0.1)} 50%,
            transparent 75%
          )`,
        }}
      />
      {/* Hairline grid — disciplined undertone, M3 surface-container vibe */}
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, opacity: 0.06 }}
      >
        <defs>
          <pattern
            id="grid"
            x="0"
            y="0"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke={PALETTE.indigoLight}
              strokeWidth="1"
            />
          </pattern>
          {/* Static film-grain so large fills never read as flat vector */}
          <filter id="mesh-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              stitchTiles="stitch"
              seed="7"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" />
      </svg>
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, opacity: 0.045 }}
      >
        <rect width={width} height={height} filter="url(#mesh-noise)" />
      </svg>
      {/* Vignette — pulls attention to the centre hero region */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 100% 80% at 50% 50%, transparent 50%, ${withAlpha(PALETTE.stageDeep, 0.55)} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
