/**
 * The format catalogue — one declaration per template.
 *
 * This is the single source of truth three consumers read: Root.tsx (which
 * compositions exist), the create-run contract (what a run may submit), and
 * the admin wizard (which steps to walk an operator through). Display copy
 * lives here too, retiring the hardcoded duplicate the frontend used to
 * carry with no backend knowledge of it.
 *
 * Adding a template is an entry in this file.
 */
import { LONG_FORM_MAX_DURATION_FRAMES } from "../constants";
import type {
  FormatConfig,
  FormatKey,
  FormatManifestEntry,
  WizardStep,
} from "./manifest-types";

export * from "./manifest-types";

/** Every market-data format walks the same path: pick a market, preview, ship. */
const MARKET_STEPS: WizardStep[] = [
  { type: "market", title: "Choose a market" },
  { type: "preview", title: "Preview" },
  { type: "confirm", title: "Confirm" },
];

/** Ranking formats swap the market search for metric/scope parameters. */
const RANKING_STEPS: WizardStep[] = [
  { type: "params", title: "Pick a metric and scope" },
  { type: "preview", title: "Preview" },
  { type: "confirm", title: "Confirm" },
];

/**
 * Market-data formats generate their own on-screen text from the data, so
 * they declare no copy fields — but they still get a designed thumbnail
 * rather than a grabbed frame.
 */
const dataThumbnail = (layout: string) => ({
  layout,
  copyFields: [
    {
      fieldId: "thumbnailHeadline",
      label: "Thumbnail headline",
      // Read at ~120px wide on a phone. More than a few words is unreadable.
      maxLength: 28,
    },
  ],
});

export const FORMAT_MANIFEST: Record<FormatKey, FormatManifestEntry> = {
  grade_reveal: {
    key: "grade_reveal",
    displayName: "Grade Reveal",
    audience: "Mixed",
    purpose: "Open with the PropertyIQ Score and grade letter, close with CTA.",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 900,
    targetSeconds: 30,
    beats: { hookSec: 3, perItemSec: 8, ctaSec: 4 },
    openWithBumper: false,
    dataSource: "single_market",
    mediaSlots: [],
    copyFields: [],
    thumbnail: dataThumbnail("score"),
    steps: MARKET_STEPS,
  },
  top_10_ranking: {
    key: "top_10_ranking",
    displayName: "Top 10 Markets",
    audience: "Investors, agents prospecting",
    purpose:
      "Celebrate the leaders by any metric. National, state, or metro scope.",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
    targetSeconds: 60,
    beats: { hookSec: 3, perItemSec: 3.5, ctaSec: 5 },
    openWithBumper: false,
    dataSource: "ranking",
    mediaSlots: [],
    copyFields: [],
    thumbnail: dataThumbnail("ranking"),
    steps: RANKING_STEPS,
  },
  bottom_10_ranking: {
    key: "bottom_10_ranking",
    displayName: "Bottom 10 — Markets to Avoid",
    audience: "Investors, agents protecting clients",
    purpose: "Spot the landmines on any metric you care about.",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
    targetSeconds: 60,
    beats: { hookSec: 3, perItemSec: 3.5, ctaSec: 5 },
    openWithBumper: false,
    dataSource: "ranking",
    mediaSlots: [],
    copyFields: [],
    thumbnail: dataThumbnail("ranking"),
    steps: RANKING_STEPS,
  },
  score_mover: {
    key: "score_mover",
    displayName: "Score Mover",
    audience: "Investor",
    purpose: "Highlight a market that moved significantly.",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 900,
    targetSeconds: 30,
    beats: { hookSec: 3, perItemSec: 8, ctaSec: 4 },
    openWithBumper: false,
    dataSource: "single_market",
    mediaSlots: [],
    copyFields: [],
    thumbnail: dataThumbnail("delta"),
    steps: MARKET_STEPS,
  },
  head_to_head: {
    key: "head_to_head",
    displayName: "Head-to-Head",
    audience: "Investor",
    purpose: "Two-market comparison on key metrics.",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
    targetSeconds: 60,
    beats: { hookSec: 3, perItemSec: 10, ctaSec: 5 },
    openWithBumper: false,
    dataSource: "single_market",
    mediaSlots: [],
    copyFields: [],
    thumbnail: dataThumbnail("versus"),
    steps: MARKET_STEPS,
  },
  long_form_deep_dive: {
    key: "long_form_deep_dive",
    displayName: "Long-Form Deep Dive",
    audience: "Mixed",
    purpose: "Narrative 5-12 minute analysis.",
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: LONG_FORM_MAX_DURATION_FRAMES,
    targetSeconds: 600,
    beats: { hookSec: 5, perItemSec: 45, ctaSec: 8 },
    // The only 16:9 long-form format — a brand open reads as production
    // value here, not as a scroll tax.
    openWithBumper: true,
    dataSource: "single_market",
    mediaSlots: [
      {
        slotId: "hero",
        label: "Metro hero image",
        kind: "image",
        required: false,
        helpText:
          "Skyline or landmark still. Curated options offered per metro.",
      },
    ],
    copyFields: [],
    thumbnail: dataThumbnail("editorial"),
    steps: MARKET_STEPS,
  },
  farm_area_spotlight: {
    key: "farm_area_spotlight",
    displayName: "Farm Area Spotlight",
    audience: "Agent",
    purpose: "Top farm areas in a metro with agent-oriented CTA.",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
    targetSeconds: 60,
    beats: { hookSec: 3, perItemSec: 12, ctaSec: 7 },
    openWithBumper: false,
    dataSource: "single_market",
    mediaSlots: [],
    copyFields: [],
    thumbnail: dataThumbnail("score"),
    steps: MARKET_STEPS,
  },
  brokerage_market_share: {
    key: "brokerage_market_share",
    displayName: "Brokerage Market Share",
    audience: "Broker",
    purpose: "Market-share breakdown by brokerage.",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 2250,
    targetSeconds: 75,
    beats: { hookSec: 3, perItemSec: 20, ctaSec: 5 },
    openWithBumper: false,
    dataSource: "single_market",
    // Named for a brokerage but carries no brokerage identity today — the
    // slot that makes the name honest. See M8.
    mediaSlots: [
      {
        slotId: "brokerageLogo",
        label: "Brokerage logo",
        kind: "image",
        required: false,
        helpText: "Transparent PNG reads best on the dark stage.",
      },
    ],
    copyFields: [],
    thumbnail: dataThumbnail("score"),
    steps: MARKET_STEPS,
  },
  recruitment_angle: {
    key: "recruitment_angle",
    displayName: "Recruitment Angle",
    audience: "Broker",
    purpose: "LinkedIn-first recruiting pitch backed by data.",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 2700,
    targetSeconds: 90,
    beats: { hookSec: 3, perItemSec: 22, ctaSec: 6 },
    openWithBumper: false,
    dataSource: "single_market",
    mediaSlots: [
      {
        slotId: "agentPhoto",
        label: "Agent photo",
        kind: "image",
        required: false,
        helpText: "Headshot. Square crops best.",
      },
    ],
    copyFields: [],
    thumbnail: dataThumbnail("score"),
    steps: MARKET_STEPS,
  },
};

export const FORMAT_KEYS = Object.keys(FORMAT_MANIFEST) as FormatKey[];

/**
 * Render-time subset, derived so dimensions can never disagree with the
 * manifest they came from.
 */
export const FORMAT_CONFIGS: Record<FormatKey, FormatConfig> = Object.freeze(
  Object.fromEntries(
    FORMAT_KEYS.map((key) => {
      const m = FORMAT_MANIFEST[key];
      return [
        key,
        {
          key: m.key,
          width: m.width,
          height: m.height,
          fps: m.fps,
          durationInFrames: m.durationInFrames,
          openWithBumper: m.openWithBumper,
          musicBed: m.musicBed,
        } satisfies FormatConfig,
      ];
    }),
  ),
) as Record<FormatKey, FormatConfig>;

/** Remotion composition id for a format (underscores are not allowed). */
export function compositionId(key: FormatKey): string {
  return key.replace(/_/g, "-");
}
