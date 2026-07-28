import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, staticFile } from "remotion";
import { AUDIO_LEVELS } from "../audio/levels";
import { AnimatedEntrance } from "../motion";
import { PALETTE } from "../styles/tokens";
import { useLayoutConfig } from "../layout/useLayoutConfig";

/**
 * 2-second opening brand sting. On the brand indigo background, the
 * shortmark pops in (spring) and the PropertyIQ wordmark rises in
 * beneath it on the house stagger. The sting is gain-staged via
 * AUDIO_LEVELS and eased out before the narration starts at frame 60.
 *
 * Assets live in /public/brand/ (shipped via Remotion's staticFile()):
 *   - piq-shortmark-192px-normal.png — the square PIQ icon + dots
 *   - piq-logo-primary-dark-reversed.png — "PropertyIQ / The IQ Behind
 *     Every Market" wordmark in light colors, meant for dark backgrounds
 */
export const BrandBumper: React.FC = () => {
  const { scale } = useLayoutConfig();

  const shortmarkSize = 260 * scale;
  const wordmarkWidth = 520 * scale;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: PALETTE.indigoDark,
        justifyContent: "center",
        alignItems: "center",
        gap: 40 * scale,
      }}
    >
      <Audio
        src={staticFile("brand-sting.mp3")}
        volume={(f) =>
          AUDIO_LEVELS.sting *
          interpolate(f, [44, 58], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <AnimatedEntrance index={0} from="scale" preset="pop">
        <Img
          src={staticFile("brand/piq-shortmark-192px-normal.png")}
          style={{
            width: shortmarkSize,
            height: shortmarkSize,
            objectFit: "contain",
          }}
        />
      </AnimatedEntrance>
      <AnimatedEntrance index={1} delay={8} from="rise" distance={18}>
        <Img
          src={staticFile("brand/piq-logo-primary-dark-reversed.png")}
          style={{
            width: wordmarkWidth,
            height: "auto",
            objectFit: "contain",
          }}
        />
      </AnimatedEntrance>
    </AbsoluteFill>
  );
};
