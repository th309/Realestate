// Brand colors hardcoded; Task 2.28 will move them to a shared variant module.
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export const DeltaDisplay: React.FC<{ delta: number }> = ({ delta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();
  const bounce = spring({ frame, fps, config: { damping: 8 } });
  const color = delta >= 0 ? "#00C853" : "#B3261E";
  const sign = delta >= 0 ? "+" : "";
  return (
    <div
      style={{
        transform: `scale(${bounce})`,
        background: color,
        color: "white",
        padding: `${12 * scale}px ${32 * scale}px`,
        borderRadius: 999,
        fontFamily: "Roboto Mono",
        fontWeight: 700,
        fontSize: 96 * scale,
      }}
    >
      {sign}
      {delta}
    </div>
  );
};
