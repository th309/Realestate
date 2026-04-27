import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { VideoProps, RankingVideoProps, FORMAT_CONFIGS } from "./types";
import {
  BRAND_OUTRO_FRAMES,
  computeRankingTiming,
} from "./layouts/top10-timing";

/**
 * Variable-duration metadata for ranking compositions. Duration is derived
 * from the actual VO word timings (captionWords) so the composition runs
 * exactly as long as the audio + brand outro, no longer or shorter. When
 * called against defaultProps (Remotion preview, before Zod) we fall through
 * the timing helper's even-spacing fallback.
 */
export const calculateRankingMetadata = ({
  props,
}: {
  props: RankingVideoProps;
}) => {
  const n = props.params?.resolved_markets?.length || 10;
  const timing = computeRankingTiming(n, props.captionWords);
  return {
    durationInFrames: timing.totalFrames + BRAND_OUTRO_FRAMES,
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
        {props.format === "bottom_10_ranking" && (
          <Top10Layout {...props} theme="bottom" />
        )}
        {props.format === "score_mover" && <ScoreMoverLayout {...props} />}
        {props.format === "head_to_head" && <HeadToHeadLayout {...props} />}
        {props.format === "farm_area_spotlight" && (
          <FarmAreaSpotlightLayout {...props} />
        )}
        {/* Other formats rendered in later phases.
            CaptionOverlay is suppressed for ranking layouts — they have
            their own editorial typography (HeroRow's city/value) that
            would compete visually with burned-in captions. Other formats
            opt-in when captionWords present. */}
        {props.format !== "top_10_ranking" &&
          props.format !== "bottom_10_ranking" &&
          props.captionWords &&
          props.captionWords.length > 0 && (
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
