// Brand colors hardcoded; Task 2.28 will move them to a shared variant module.
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface CaptionWord {
  startMs: number;
  endMs: number;
  word: string;
}

export const CaptionOverlay: React.FC<{ words: CaptionWord[] }> = ({
  words,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();
  const currentMs = (frame / fps) * 1000;
  const active = words.filter(
    (w) => currentMs >= w.startMs - 200 && currentMs <= w.endMs + 200,
  );
  const text = active.map((w) => w.word).join(" ");
  if (!text) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 80 * scale,
        left: 40 * scale,
        right: 40 * scale,
        textAlign: "center",
        fontFamily: "Roboto",
        fontWeight: 700,
        fontSize: 42 * scale,
        color: "#FFFFFF",
        textShadow: "0 2px 8px rgba(0,0,0,0.8)",
      }}
    >
      {text}
    </div>
  );
};
