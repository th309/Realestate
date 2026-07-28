import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import {
  VideoProps,
  RankingVideoProps,
  SingleMarketVideoProps,
  ProductDemoVideoProps,
  FORMAT_CONFIGS,
  FORMAT_MANIFEST,
} from "./types";
import { AudioMix } from "./audio/AudioMix";
import { buildSfxCues } from "./audio/sfx-cues";
import { PALETTE } from "./styles/tokens";
import {
  LONG_FORM_MAX_DURATION_FRAMES,
  narrationStartFrame,
} from "./constants";
import {
  BRAND_OUTRO_FRAMES,
  MAX_RANKING_ROWS,
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
  // Cap to the rows the layout actually renders (Top10Layout slices to the
  // same limit). An over-fetched candidate list would otherwise make this
  // compute a duration for rows nobody sees — and worse, the caption-aligned
  // branch requires one "Number N" cue per row, so an inflated rowCount
  // silently drops it to generic even-spacing and the composition's length
  // stops matching its own audio.
  const n = Math.min(
    MAX_RANKING_ROWS,
    props.params?.resolved_markets?.length || MAX_RANKING_ROWS,
  );
  const timing = computeRankingTiming(
    n,
    props.captionWords,
    FORMAT_CONFIGS[props.format].openWithBumper,
  );
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
import { ProductDemoLayout } from "./layouts/ProductDemoLayout";
import { isProductDemoFormat } from "./formats/product-demo-format";
import { buildProductDemoBeats } from "./lib/product-demo-timing";

/**
 * A product demo's length comes from how many features were authored, not
 * from a catalogue constant — three features and six are different videos.
 */
export const calculateProductDemoMetadata = ({
  props,
}: {
  props: ProductDemoVideoProps;
}) => {
  const manifest = FORMAT_MANIFEST[props.format];
  const hookFrames =
    props.hook?.kind === "avatar_video"
      ? props.hook.slot?.durationInFrames
      : undefined;
  const beats = buildProductDemoBeats(
    props.features?.length ?? 1,
    manifest.beats,
    manifest.fps,
    hookFrames,
  );
  return {
    durationInFrames: beats.totalFrames,
    fps: manifest.fps,
    width: manifest.width,
    height: manifest.height,
  };
};

export const PropertyIQVideo: React.FC<VideoProps> = (props) => {
  const cfg = FORMAT_CONFIGS[props.format];
  const { durationInFrames } = useVideoConfig();
  return (
    <VideoLayout config={cfg}>
      <AbsoluteFill style={{ backgroundColor: PALETTE.stage }}>
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
        {isProductDemoFormat(props.format) && (
          <ProductDemoLayout {...(props as ProductDemoVideoProps)} />
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
        Full program mix: narration, sidechain-ducked music bed, room tone,
        and entrance SFX frame-locked to the layout beats. Narration starts
        at frame 0 on vertical short-form and after the sting on bumper'd
        long-form (see narrationStartFrame). It still ends before the video
        does (ffprobe cap in synthesize-audio.handler enforces the budget).
      */}
      <AudioMix
        audioUrl={props.audioUrl}
        captionWords={props.captionWords}
        narrationStartFrame={narrationStartFrame(cfg)}
        cues={buildSfxCues(props, durationInFrames)}
        musicBed={props.musicBed ?? cfg.musicBed}
      />
    </VideoLayout>
  );
};
