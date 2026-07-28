/**
 * Per-format SFX cue lists — frame-locked to the SAME beat sources the
 * layouts render from (grade-reveal-beats, ranking timing), so audio and
 * motion can never drift apart.
 */
import type { SfxCue } from "./AudioMix";
import { buildGradeRevealBeats } from "../layouts/grade-reveal-beats";
import {
  MAX_RANKING_ROWS,
  computeRankingTiming,
} from "../layouts/top10-timing";
import {
  DELTA_SETTLE_FRAMES,
  DELTA_TICK_DELAY,
  buildScoreMoverBeats,
} from "../layouts/ScoreMoverLayout";
import {
  buildFarmAreaBeats,
  FARM_AREA_CARD_COUNT,
} from "../layouts/FarmAreaSpotlightLayout";
import { SCORE_DIAL_DELAY } from "../scenes/ScoreReveal";
import { STAGGER_FRAMES } from "../motion/presets";
import { FORMAT_CONFIGS } from "../types";
import type { RankingVideoProps, VideoProps } from "../types";

/** Approx. frames from dial-sweep start until the counter spring settles. */
const DIAL_SETTLE_FRAMES = 76;

function gradeFamilyCues(scale: number, openWithBumper: boolean): SfxCue[] {
  const beats = buildGradeRevealBeats(scale, openWithBumper);
  const cues: SfxCue[] = [
    { frame: beats.intro.from, sound: "whoosh" },
    { frame: beats.score.from, sound: "whoosh" },
    { frame: beats.score.from + SCORE_DIAL_DELAY, sound: "tick" },
    {
      frame: beats.score.from + SCORE_DIAL_DELAY + DIAL_SETTLE_FRAMES,
      sound: "chime",
    },
    { frame: beats.stats.from, sound: "whoosh" },
    { frame: beats.outro.from, sound: "whoosh" },
    { frame: beats.brand.from + 8, sound: "chime" },
  ];
  // One soft tick per stat card, on the card's staggered entrance frame
  // (StatCards: base delay 6, card indices start at 2).
  for (let i = 0; i < 6; i++) {
    cues.push({
      frame: beats.stats.from + 6 + (i + 2) * STAGGER_FRAMES,
      sound: "tick",
      volume: 0.2,
    });
  }
  return cues;
}

/**
 * Ranking countdowns: the reveal frames come from the SAME
 * computeRankingTiming() call Top10Layout renders from, so each whoosh lands
 * exactly as the narrator says "Number N." and the hero row swaps. The final
 * stage is #1 (the layout reverses the list), so it gets the chime.
 */
function rankingCues(
  props: RankingVideoProps,
  openWithBumper: boolean,
): SfxCue[] {
  // Mirrors Top10Layout: at most MAX_RANKING_ROWS markets, counted #N → #1.
  const rowCount = Math.min(
    MAX_RANKING_ROWS,
    props.params.resolved_markets.length,
  );
  const timing = computeRankingTiming(
    rowCount,
    props.captionWords,
    openWithBumper,
  );
  const cues: SfxCue[] = [{ frame: timing.hookStartFrame, sound: "whoosh" }];
  timing.rowStartFrames.forEach((frame, i) => {
    const isFinalRank = i === timing.rowStartFrames.length - 1;
    cues.push({ frame, sound: "whoosh", volume: 0.3 });
    if (isFinalRank) cues.push({ frame, sound: "chime" });
  });
  cues.push({ frame: timing.outroStartFrame, sound: "whoosh" });
  return cues;
}

/**
 * Score-mover: tick when the number starts climbing, chime when the
 * `counter` spring settles on the new score, whoosh on every scene change.
 * Frames come from SCORE_MOVER_BEATS — the layout's own beat table.
 */
function scoreMoverCues(openWithBumper: boolean): SfxCue[] {
  const b = buildScoreMoverBeats(openWithBumper);
  const tickStart = b.delta.from + DELTA_TICK_DELAY;
  return [
    { frame: b.intro.from, sound: "whoosh" },
    { frame: b.delta.from, sound: "whoosh" },
    { frame: tickStart, sound: "tick" },
    { frame: tickStart + DELTA_SETTLE_FRAMES, sound: "chime" },
    { frame: b.stats.from, sound: "whoosh" },
    { frame: b.outro.from, sound: "whoosh" },
    { frame: b.brand.from + 8, sound: "chime" },
  ];
}

/**
 * Farm-area spotlight: whoosh as the grid scene opens, then one soft tick
 * per card on its staggered entrance frame (FarmAreaGrid uses the house
 * index * STAGGER_FRAMES offset with no extra base delay).
 */
function farmAreaCues(openWithBumper: boolean): SfxCue[] {
  const b = buildFarmAreaBeats(openWithBumper);
  const cues: SfxCue[] = [
    { frame: b.intro.from, sound: "whoosh" },
    { frame: b.grid.from, sound: "whoosh" },
  ];
  for (let i = 0; i < FARM_AREA_CARD_COUNT; i++) {
    cues.push({
      frame: b.grid.from + i * STAGGER_FRAMES,
      sound: "tick",
      volume: 0.2,
    });
  }
  cues.push({ frame: b.outro.from, sound: "whoosh" });
  cues.push({ frame: b.brand.from + 8, sound: "chime" });
  return cues;
}

/**
 * Cues for a format. Formats without a bespoke plan get scene-change
 * bookends only (extend this switch when a layout's beats are reworked).
 */
export function buildSfxCues(
  props: VideoProps,
  durationInFrames: number,
): SfxCue[] {
  // Read from the same format config the layout builds its beats from, so a
  // bumper-less format's cues shift with its visuals instead of drifting.
  const { openWithBumper } = FORMAT_CONFIGS[props.format];
  switch (props.format) {
    case "grade_reveal":
      return gradeFamilyCues(1, openWithBumper);
    case "brokerage_market_share":
      return gradeFamilyCues(2.5, openWithBumper);
    case "recruitment_angle":
      return gradeFamilyCues(3, openWithBumper);
    case "top_10_ranking":
    case "bottom_10_ranking":
      return rankingCues(props, openWithBumper);
    case "score_mover":
      return scoreMoverCues(openWithBumper);
    case "farm_area_spotlight":
      return farmAreaCues(openWithBumper);
    default:
      return [
        { frame: openWithBumper ? 60 : 0, sound: "whoosh" },
        { frame: Math.max(90, durationInFrames - 80), sound: "chime" },
      ];
  }
}
