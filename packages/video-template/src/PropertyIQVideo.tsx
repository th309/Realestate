import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { VideoProps, FORMAT_CONFIGS } from "./types";

// ---------------------------------------------------------------------------
// Variable-duration metadata for ranking compositions
// ---------------------------------------------------------------------------
const INTRO_FRAMES = 90; // 3.0s @ 30fps
const ROW_FRAMES = 150; // 5.0s per row
const OUTRO_FRAMES = 135; // 4.5s

export const calculateRankingMetadata = ({ props }: { props: VideoProps }) => {
  const n = props.params?.resolved_markets?.length ?? 10;
  return {
    durationInFrames: INTRO_FRAMES + n * ROW_FRAMES + OUTRO_FRAMES,
    fps: 30,
    width: 1080,
    height: 1920,
  };
};
import { VideoLayout } from "./layout/VideoLayout";
import { GradeRevealLayout } from "./layouts/GradeRevealLayout";
import { Top10Layout } from "./layouts/Top10Layout";
import { ScoreMoverLayout } from "./layouts/ScoreMoverLayout";
import { HeadToHeadLayout } from "./layouts/HeadToHeadLayout";
import { FarmAreaSpotlightLayout } from "./layouts/FarmAreaSpotlightLayout";
import { CaptionOverlay } from "./primitives/CaptionOverlay";

export const PropertyIQVideo: React.FC<VideoProps> = (props) => {
  const cfg = FORMAT_CONFIGS[props.format];
  return (
    <VideoLayout config={cfg}>
      <AbsoluteFill style={{ backgroundColor: "#1A1A2E" }}>
        {props.format === "grade_reveal" && <GradeRevealLayout {...props} />}
        {props.format === "top_10_ranking" && <Top10Layout {...props} />}
        {props.format === "score_mover" && <ScoreMoverLayout {...props} />}
        {props.format === "head_to_head" && <HeadToHeadLayout {...props} />}
        {props.format === "farm_area_spotlight" && (
          <FarmAreaSpotlightLayout {...props} />
        )}
        {/* Other formats rendered in later phases */}
        {props.captionWords && props.captionWords.length > 0 && (
          <CaptionOverlay words={props.captionWords} />
        )}
      </AbsoluteFill>
      {/*
        Delay voice-over until after the 2-second BrandBumper (60 frames
        @ 30fps) so the brand sting plays clean, without the narrator
        talking over the intro logo. Audio plays from its start through
        to its natural end (ffprobe cap in synthesize-audio.handler
        ensures audio_length <= duration - audio_buffer_seconds, so even
        the longest legal audio still ends before the video does).
      */}
      {props.audioUrl && (
        <Sequence from={60}>
          <Audio src={props.audioUrl} />
        </Sequence>
      )}
    </VideoLayout>
  );
};
