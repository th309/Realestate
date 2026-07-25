/**
 * Format preview metadata for the create-a-run wizard.
 * Preview videos are the sample renders produced by packages/video-template.
 */

export const FORMAT_PREVIEWS: Record<string, string> = {
  grade_reveal: "/format-previews/grade-reveal.mp4",
  top_10_ranking: "/format-previews/top-10-ranking.mp4",
  bottom_10_ranking: "/format-previews/bottom-10-ranking.mp4",
  score_mover: "/format-previews/score-mover.mp4",
  head_to_head: "/format-previews/head-to-head.mp4",
  long_form_deep_dive: "/format-previews/long-form-deep-dive.mp4",
  farm_area_spotlight: "/format-previews/farm-area-spotlight.mp4",
  brokerage_market_share: "/format-previews/brokerage-market-share.mp4",
  recruitment_angle: "/format-previews/recruitment-angle.mp4",
};

export interface FormatMeta {
  displayName: string;
  audience: string;
  duration: number;
  aspect: string;
  purpose: string;
}

/**
 * Whether a string is one of the wizard's run formats (the FORMAT_META keys are
 * the single source of truth). Shared by the create-a-run prefill and the video
 * script "Make this video" handoff so the membership check lives in one place.
 */
export function isValidRunFormat(
  format: string | null | undefined,
): format is string {
  return (
    format != null && Object.prototype.hasOwnProperty.call(FORMAT_META, format)
  );
}

export const FORMAT_META: Record<string, FormatMeta> = {
  grade_reveal: {
    displayName: "Grade Reveal",
    audience: "Mixed",
    duration: 30,
    aspect: "9:16",
    purpose: "Open with the PropertyIQ Score and grade letter, close with CTA.",
  },
  top_10_ranking: {
    displayName: "Top 10 Markets",
    audience: "Investors, agents prospecting",
    duration: 60,
    aspect: "9:16",
    purpose:
      "Celebrate the leaders by any metric. National, state, or metro scope.",
  },
  bottom_10_ranking: {
    displayName: "Bottom 10 — Markets to Avoid",
    audience: "Investors, agents protecting clients",
    duration: 60,
    aspect: "9:16",
    purpose: "Spot the landmines on any metric you care about.",
  },
  score_mover: {
    displayName: "Score Mover",
    audience: "Investor",
    duration: 30,
    aspect: "9:16",
    purpose: "Highlight a market that moved significantly.",
  },
  head_to_head: {
    displayName: "Head-to-Head",
    audience: "Investor",
    duration: 60,
    aspect: "9:16",
    purpose: "Two-market comparison on key metrics.",
  },
  long_form_deep_dive: {
    displayName: "Long-Form Deep Dive",
    audience: "Mixed",
    duration: 600,
    aspect: "16:9",
    purpose: "Narrative 5-12 minute analysis.",
  },
  farm_area_spotlight: {
    displayName: "Farm Area Spotlight",
    audience: "Agent",
    duration: 60,
    aspect: "9:16",
    purpose: "Top farm areas in a metro with agent-oriented CTA.",
  },
  brokerage_market_share: {
    displayName: "Brokerage Market Share",
    audience: "Broker",
    duration: 75,
    aspect: "9:16",
    purpose: "Market-share breakdown by brokerage.",
  },
  recruitment_angle: {
    displayName: "Recruitment Angle",
    audience: "Broker",
    duration: 90,
    aspect: "9:16",
    purpose: "LinkedIn-first recruiting pitch backed by data.",
  },
};
