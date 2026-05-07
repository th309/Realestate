import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS } from "../constants";

type MetroHeroStillProps = {
  /** HTTPS URL from `metro-hero-curated-urls.json` or `resolvedMarket.hero_image_url`. */
  imageUrl: string;
  marketLabel: string;
};

/** Full-frame still after the map fly — city photo from curated URLs / pipeline props. */
export const MetroHeroStill: React.FC<MetroHeroStillProps> = ({
  imageUrl,
  marketLabel,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const opacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });

  const labelShadow = `0 2px 12px ${COLORS.bg}`;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Img
        src={imageUrl}
        alt=""
        delayRenderTimeoutInMilliseconds={25_000}
        style={{
          width,
          height,
          objectFit: "cover",
          opacity,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(15,23,42,0.92) 0%, transparent 45%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: 0,
          right: 0,
          textAlign: "center",
          pointerEvents: "none",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          fontSize: 26,
          fontWeight: 700,
          color: COLORS.text,
          textShadow: labelShadow,
          opacity,
        }}
      >
        {marketLabel}
      </div>
    </AbsoluteFill>
  );
};
