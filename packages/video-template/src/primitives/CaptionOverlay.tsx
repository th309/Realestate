import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS, PALETTE, withAlpha } from "../styles/tokens";
import { useLayoutConfig } from "../layout/useLayoutConfig";
import {
  activeChunk,
  activeWordIndex,
  buildCaptionChunks,
  type CaptionChunk,
  type CaptionWord,
} from "../lib/caption-chunks";

export type { CaptionWord };

/**
 * Burned-in captions, word-by-word.
 *
 * Most social video is watched muted, so captions carry the message rather
 * than decorating it. A short line sits on screen and the spoken word is
 * accented as it lands — the current short-form convention, and far easier
 * to track than a sliding word window.
 *
 * Sits above the platform's own bottom chrome (see styles/safe-zones): on
 * TikTok/Reels the lower fifth of the frame is covered by the caption block
 * and music ticker, so anything drawn there is invisible in the app.
 */
export const CaptionOverlay: React.FC<{ words: CaptionWord[] }> = ({
  words,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, isVertical, safeZone } = useLayoutConfig();
  const currentMs = (frame / fps) * 1000;

  const chunks = React.useMemo(() => buildCaptionChunks(words), [words]);
  const chunk = activeChunk(chunks, currentMs);
  if (!chunk) return null;

  const spokenIndex = activeWordIndex(chunk, currentMs);

  // Large enough to read at arm's length on a phone; the muted viewer is
  // reading these, not glancing at them.
  const fontSize = (isVertical ? 62 : 44) * scale;

  return (
    <div
      style={{
        position: "absolute",
        bottom: safeZone.bottom + 24 * scale,
        left: safeZone.left,
        right: safeZone.right,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "baseline",
        gap: `${0.32 * scale}em`,
        fontFamily: FONTS.body,
        fontWeight: 800,
        fontSize,
        lineHeight: 1.15,
        letterSpacing: "-0.01em",
        textAlign: "center",
      }}
    >
      {chunk.words.map((word, i) => (
        <CaptionToken
          key={`${word.startMs}-${i}`}
          word={word}
          spoken={i <= spokenIndex}
          active={i === spokenIndex}
        />
      ))}
    </div>
  );
};

const CaptionToken: React.FC<{
  word: CaptionWord;
  spoken: boolean;
  active: boolean;
}> = ({ word, spoken, active }) => (
  <span
    style={{
      /*
       * The word being spoken must be the MOST visible thing in the line.
       * Indigo accent fails here — it's the stage color, so it recedes into
       * the background instead of popping. Amber is the highest-contrast
       * token against the dark navy stage, and it avoids the green/red
       * tokens that carry "positive/negative metric" meaning elsewhere in
       * the product.
       *
       * Words already spoken stay bright so the line reads as a whole
       * phrase; unspoken words sit dim but present, keeping the line's
       * shape stable so the eye never has to re-find its place.
       */
      color: active
        ? PALETTE.warning
        : spoken
          ? PALETTE.surface
          : PALETTE.indigoLight,
      opacity: active ? 1 : spoken ? 0.92 : 0.5,
      textShadow: `0 2px 10px ${withAlpha(PALETTE.stageDeep, 0.9)}`,
      transform: active ? "translateY(-2%)" : undefined,
      display: "inline-block",
    }}
  >
    {word.word}
  </span>
);

export type { CaptionChunk };
