import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  staticFile,
} from "remotion";
import { useLayoutConfig } from "../layout/useLayoutConfig";

/**
 * 2-second opening brand sting. Plays PIQ mark on brand indigo
 * background with an audio sting from /public/brand-sting.mp3.
 */
export const BrandBumper: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();
  const opacity = spring({ frame, fps, config: { damping: 15 } });
  const size = 200 * scale;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1A237E",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Audio src={staticFile("brand-sting.mp3")} />
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "#3949AB",
          opacity,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "Roboto",
          color: "#FFFFFF",
          fontWeight: 700,
          fontSize: 64 * scale,
        }}
      >
        PIQ
      </div>
    </AbsoluteFill>
  );
};
