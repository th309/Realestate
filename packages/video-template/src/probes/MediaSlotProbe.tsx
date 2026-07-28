import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { MediaSlot } from "../primitives/MediaSlot";
import { MediaCallout } from "../primitives/MediaCallout";
import { MeshBackground } from "../primitives/MeshBackground";
import { VideoLayout } from "../layout/VideoLayout";
import type { FormatConfig } from "../types";
import type { MediaSlotValue } from "../media/media-slot";

/**
 * Render harness for the media-slot primitives.
 *
 * This package had never embedded real video before MediaSlot — everything
 * was generated graphics over still images. OffthreadVideo behaves
 * differently under a headless render than in the Studio preview, so this
 * composition exists to prove, through the same CLI the backend calls, that
 * both slot kinds actually decode and composite. Cheap permanent regression
 * cover for "can we put a screenshot or a clip in a video at all".
 *
 * Not a customer-facing format — deliberately absent from FORMAT_CONFIGS.
 */

const IMAGE_SLOT: MediaSlotValue = {
  slotId: "probe-image",
  kind: "image",
  // The fixture puts a green stat block here; punching in should fill the
  // frame with it, which is what the snapshot asserts.
  url: staticFile("test-fixtures/dashboard.png"),
  focusRegion: { x: 0.63, y: 0.2, w: 0.22, h: 0.16 },
  sourceAspect: 1600 / 900,
  spotlight: true,
};

const VIDEO_SLOT: MediaSlotValue = {
  slotId: "probe-video",
  kind: "video",
  url: staticFile("test-fixtures/clip.mp4"),
};

export const MEDIA_SLOT_PROBE_DURATION = 180;

/**
 * Callouts read safe-zone insets off the layout context, so the probe has
 * to mount inside VideoLayout exactly as PropertyIQVideo does — otherwise
 * it isn't exercising the primitives in the shape they actually run.
 */
const PROBE_FORMAT: FormatConfig = {
  key: "grade_reveal",
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: MEDIA_SLOT_PROBE_DURATION,
  openWithBumper: false,
};

export const MediaSlotProbe: React.FC = () => (
  <VideoLayout config={PROBE_FORMAT}>
    <AbsoluteFill>
      <MeshBackground />
      <Sequence from={0} durationInFrames={90}>
        <MediaSlot slot={IMAGE_SLOT} durationInFrames={90} />
        <MediaCallout
          text="Live market score"
          at={{ x: 0.3, y: 0.34 }}
          index={0}
        />
      </Sequence>
      <Sequence from={90} durationInFrames={90}>
        <MediaSlot slot={VIDEO_SLOT} durationInFrames={90} />
      </Sequence>
    </AbsoluteFill>
  </VideoLayout>
);
