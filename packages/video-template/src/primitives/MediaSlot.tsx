import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  staticFile,
  useVideoConfig,
} from "remotion";
import { useScriptedProgress } from "../motion";
import { PALETTE, withAlpha } from "../styles/tokens";
import { punchInGeometry, type MediaSlotValue } from "../media/media-slot";

export interface MediaSlotProps {
  slot: MediaSlotValue;
  /** How long this slot is on screen — the punch-in spans it. */
  durationInFrames: number;
  /** Frames to hold at the wide view before the move begins. */
  settleFrames?: number;
}

/**
 * Renders one operator-supplied asset.
 *
 * The important behavior is the punch-in: rather than drifting across a
 * whole screenshot (unreadable on a phone, and visually dead), the shot
 * pushes INTO the one region being talked about. With no focusRegion it
 * falls back to a gentle Ken-Burns, which is right for a photographic hero
 * and wrong for a dashboard.
 *
 * Note this is the first component in the package to embed real video.
 * OffthreadVideo (not Video) is required for correct frame-accurate
 * extraction during a headless render.
 */
export const MediaSlot: React.FC<MediaSlotProps> = ({
  slot,
  durationInFrames,
  settleFrames = 8,
}) => {
  const { width, height } = useVideoConfig();

  // Scripted, not springy — a camera move should ease, not overshoot.
  const progress = useScriptedProgress(
    settleFrames,
    Math.max(settleFrames + 1, durationInFrames),
    "emphasized",
  );

  const geo = punchInGeometry(slot.focusRegion, progress, width, height, {
    sourceAspect: slot.sourceAspect,
  });

  /*
   * A bare relative path means an asset shipped inside this package, and
   * must go through staticFile() HERE — resolving it caller-side gives a
   * URL that does not exist, because staticFile only knows the serve origin
   * from inside the render.
   *
   * Idempotent on purpose: a signed https link from a real run passes
   * through, and so does a path a caller ALREADY put through staticFile()
   * (which returns a root-relative path, not a scheme). Resolving one of
   * those twice yields a doubled prefix that silently 404s.
   */
  const alreadyResolved =
    /^[a-z][a-z0-9+.-]*:/i.test(slot.url) || slot.url.startsWith("/");
  const src = alreadyResolved ? slot.url : staticFile(slot.url);

  // The element is laid out at the ASSET's shape, not the frame's, so the
  // focus region's coordinates stay linear under the transform.
  const assetStyle: React.CSSProperties = {
    width: geo.boxWidth,
    height: geo.boxHeight,
    objectFit: "cover",
    display: "block",
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: geo.boxWidth,
          height: geo.boxHeight,
          transformOrigin: "0 0",
          transform: `translate(${geo.translateX}px, ${geo.translateY}px) scale(${geo.scale})`,
        }}
      >
        {slot.kind === "image" ? (
          <Img src={src} style={assetStyle} />
        ) : (
          <OffthreadVideo
            src={src}
            startFrom={msToFrames(slot.trimMs?.start)}
            endAt={msToFrames(slot.trimMs?.end)}
            style={assetStyle}
          />
        )}
      </div>

      {slot.spotlight && slot.focusRegion && (
        <Spotlight rect={geo.regionOnScreen} />
      )}
    </AbsoluteFill>
  );
};

/**
 * Dims everything outside the focus region so the eye is told exactly where
 * to look. Drawn as a hole punched through a full-bleed scrim via an
 * outsized spread shadow — cheaper and crisper than compositing four edge
 * panels, and it stays put while the region moves underneath it.
 */
const Spotlight: React.FC<{
  rect: { left: number; top: number; width: number; height: number };
}> = ({ rect }) => (
  <div
    style={{
      position: "absolute",
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      borderRadius: 12,
      boxShadow: `0 0 0 9999px ${withAlpha(PALETTE.stageDeep, 0.62)}`,
      pointerEvents: "none",
    }}
  />
);

function msToFrames(ms: number | undefined): number | undefined {
  if (ms === undefined) return undefined;
  // 30fps is the package-wide rate (FORMAT_CONFIGS); trims are authored in
  // ms because that is what an operator scrubbing a clip actually reads.
  return Math.round((ms / 1000) * 30);
}
