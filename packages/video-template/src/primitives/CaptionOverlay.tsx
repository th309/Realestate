import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS, PALETTE, withAlpha } from "../styles/tokens";
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
        fontFamily: FONTS.body,
        fontWeight: 700,
        fontSize: 42 * scale,
        color: PALETTE.surface,
        textShadow: `0 2px 8px ${withAlpha(PALETTE.stageDeep, 0.85)}`,
      }}
    >
      {text}
    </div>
  );
};
