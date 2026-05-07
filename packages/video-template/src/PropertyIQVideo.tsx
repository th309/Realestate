import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import {
  VideoProps,
  RankingVideoProps,
  SingleMarketVideoProps,
  FORMAT_CONFIGS,
} from "./types";
import { LONG_FORM_MAX_DURATION_FRAMES } from "./constants";
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

function clampLongFormDuration(frames: number): number {
  return Math.min(
    LONG_FORM_MAX_DURATION_FRAMES,
    Math.max(600, Math.round(frames)),
  );
}

/** Long-form duration: prefer server-built plan; else caption end + tail; else catalog default. Capped at 5 minutes. */
export const calculateLongFormMetadata = ({
  props,
}: {
  props: SingleMarketVideoProps;
}) => {
  const plan = props.longFormRenderPlan;
  if (plan?.durationInFrames && plan.durationInFrames > 0) {
    return {
      durationInFrames: clampLongFormDuration(plan.durationInFrames),
      fps: 30,
      width: 1920,
      height: 1080,
    };
  }
  const cw = props.captionWords;
  if (cw && cw.length > 0) {
    const lastMs = cw[cw.length - 1].endMs;
    const tail = 120;
    const d = 60 + Math.ceil((lastMs / 1000) * 30) + tail;
    return {
      durationInFrames: clampLongFormDuration(d),
      fps: 30,
      width: 1920,
      height: 1080,
    };
  }
  return {
    durationInFrames: FORMAT_CONFIGS.long_form_deep_dive.durationInFrames,
    fps: 30,
    width: 1920,
    height: 1080,
  };
};
import { VideoLayout } from "./layout/VideoLayout";
import { GradeRevealLayout } from "./layouts/GradeRevealLayout";
import { Top10Layout } from "./layouts/Top10Layout";
import { ScoreMoverLayout } from "./layouts/ScoreMoverLayout";
import { HeadToHeadLayout } from "./layouts/HeadToHeadLayout";
import { FarmAreaSpotlightLayout } from "./layouts/FarmAreaSpotlightLayout";
import { LongFormDeepDiveLayout } from "./layouts/LongFormDeepDiveLayout";
import { BrokerageMarketShareLayout } from "./layouts/BrokerageMarketShareLayout";
import { RecruitmentAngleLayout } from "./layouts/RecruitmentAngleLayout";
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
        {props.format === "long_form_deep_dive" && (
          <LongFormDeepDiveLayout {...props} />
        )}
        {props.format === "brokerage_market_share" && (
          <BrokerageMarketShareLayout {...props} />
        )}
        {props.format === "recruitment_angle" && (
          <RecruitmentAngleLayout {...props} />
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
