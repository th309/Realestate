/**
 * Format catalog — the per-FormatKey render contract.
 *
 * Split out of types.ts (which was over the 300-line limit) and the seed of
 * the fuller format manifest: this is the single place a format declares its
 * dimensions, duration, and opening behavior, read by Root.tsx when it
 * registers compositions.
 */
import { LONG_FORM_MAX_DURATION_FRAMES } from "../constants";
import type { MusicBedName } from "../audio/levels";

export type FormatKey =
  | "grade_reveal"
  | "top_10_ranking"
  | "bottom_10_ranking"
  | "score_mover"
  | "head_to_head"
  | "long_form_deep_dive"
  | "farm_area_spotlight"
  | "brokerage_market_share"
  | "recruitment_angle";

export interface FormatConfig {
  key: FormatKey;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /**
   * Whether the composition opens with the 2s BrandBumper sting.
   *
   * Only long-form 16:9 does. On vertical short-form (TikTok/Reels/Shorts)
   * a logo animation before anything is said is a scroll-killer — the hook
   * has to land in the first second, and the brand belongs at the END
   * (BrandOutroCard). When false, the bumper's frames are reclaimed by the
   * content beats rather than left as a gap, and narration starts at 0.
   */
  openWithBumper: boolean;
  /**
   * Default music bed for this format. Omit for the house default. A run
   * can override it via props so two videos in the same format don't have
   * to sound identical.
   */
  musicBed?: MusicBedName;
}

export const FORMAT_CONFIGS: Record<FormatKey, FormatConfig> = {
  grade_reveal: {
    key: "grade_reveal",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 900,
    openWithBumper: false,
  },
  top_10_ranking: {
    key: "top_10_ranking",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
    openWithBumper: false,
  },
  bottom_10_ranking: {
    key: "bottom_10_ranking",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
    openWithBumper: false,
  },
  score_mover: {
    key: "score_mover",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 900,
    openWithBumper: false,
  },
  head_to_head: {
    key: "head_to_head",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
    openWithBumper: false,
  },
  long_form_deep_dive: {
    key: "long_form_deep_dive",
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: LONG_FORM_MAX_DURATION_FRAMES,
    // The only 16:9 long-form format — a brand open reads as production
    // value here, not as a scroll tax.
    openWithBumper: true,
  },
  farm_area_spotlight: {
    key: "farm_area_spotlight",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
    openWithBumper: false,
  },
  brokerage_market_share: {
    key: "brokerage_market_share",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 2250,
    openWithBumper: false,
  },
  recruitment_angle: {
    key: "recruitment_angle",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 2700,
    openWithBumper: false,
  },
};
