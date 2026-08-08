/**
 * The six accent families the analyzer cards draw from, per the approved
 * mockup. Each tone is a `-soft` container fill paired with its accent
 * foreground — the combination used by every icon tile, grade pill and
 * difficulty chip on the page.
 *
 * These are deliberately a closed set. The mockup assigns one hue per concern
 * so a column of cards reads as distinct sections rather than one striped
 * block: indigo for cash mechanics, green for outcomes, red for failure, amber
 * for caution and levers, violet for the grading rubric, teal for market.
 */
export type PiqTone = "indigo" | "green" | "red" | "amber" | "violet" | "teal";

interface ToneClasses {
  /** Container fill + accent foreground, for tiles and chips. */
  tile: string;
  /** Accent as a foreground colour on a pale surface. */
  text: string;
  /** Accent as a border colour. */
  border: string;
}

export const TONE: Record<PiqTone, ToneClasses> = {
  indigo: {
    tile: "bg-piq-indigo-soft text-piq-indigo",
    text: "text-piq-indigo",
    border: "border-piq-indigo",
  },
  green: {
    tile: "bg-piq-green-soft text-piq-green",
    text: "text-piq-green",
    border: "border-piq-green",
  },
  red: {
    tile: "bg-piq-red-soft text-piq-red",
    text: "text-piq-red",
    border: "border-piq-red",
  },
  amber: {
    tile: "bg-piq-amber-soft text-piq-amber",
    text: "text-piq-amber",
    border: "border-piq-amber",
  },
  violet: {
    tile: "bg-piq-violet-soft text-piq-violet",
    text: "text-piq-violet",
    border: "border-piq-violet",
  },
  teal: {
    tile: "bg-piq-teal-soft text-piq-teal",
    text: "text-piq-teal",
    border: "border-piq-teal",
  },
};

/**
 * The mockup's `.lab`: 10px / 700 / 0.11em / uppercase / muted. Used for every
 * micro-label on the page — KPI captions, card-header right rails, slider
 * names, chart eyebrows — so it lives here rather than being retyped.
 */
export const LABEL_CLASS =
  "text-[10px] font-bold uppercase tracking-[0.11em] text-piq-muted";

/**
 * The mockup's `.n`: mono, tabular, slightly tightened. Every figure on the
 * page uses it, including numbers inline in prose.
 */
export const NUM_CLASS = "font-mono tabular-nums tracking-[-0.02em]";
