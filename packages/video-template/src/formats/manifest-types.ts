/**
 * The format manifest's shape.
 *
 * A format declares everything about itself in one place: how it renders,
 * what inputs it needs, and how an operator is walked through authoring it.
 * Three consumers read the same declaration — the composition registry, the
 * create-run contract, and the admin wizard — which is what makes adding a
 * template a data change rather than a four-file surgery.
 *
 * Types live apart from the data so `manifest.ts` stays readable as a
 * catalogue and neither file pushes past the size limit.
 */
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

/** Where a format's data comes from — decides which wizard steps appear. */
export type FormatDataSource = "single_market" | "ranking" | "none";

export interface MediaSlotDeclaration {
  slotId: string;
  /** Shown above the dropzone. */
  label: string;
  kind: "image" | "video";
  required: boolean;
  /** Guidance shown under the dropzone, e.g. "1920x1080 screenshot". */
  helpText?: string;
}

export interface CopyFieldDeclaration {
  fieldId: string;
  label: string;
  maxLength: number;
  /**
   * Ask the model for this many alternatives instead of one. Used for the
   * hook, which is the line most worth shopping.
   */
  variants?: number;
  /** Part of a repeating group (e.g. one per feature) rather than a single field. */
  repeating?: boolean;
}

/**
 * Beat budget in seconds. The renderer converts to frames; authoring and
 * copy generation reason in seconds because that is how length is decided.
 */
export interface BeatBudget {
  hookSec: number;
  /** Per repeated content beat (a feature, a market, a rank). */
  perItemSec: number;
  ctaSec: number;
}

export type WizardStepType =
  | "market"
  | "params"
  | "copy"
  | "media"
  | "preview"
  | "confirm";

export interface WizardStep {
  type: WizardStepType;
  /** Step heading in the wizard. */
  title: string;
}

export interface ThumbnailDeclaration {
  /** Which thumbnail layout variant to render. */
  layout: string;
  copyFields: CopyFieldDeclaration[];
}

export interface FormatManifestEntry {
  key: FormatKey;
  displayName: string;
  audience: string;
  purpose: string;

  width: number;
  height: number;
  fps: number;
  /** Catalogue duration; formats with variable length override at render time. */
  durationInFrames: number;
  targetSeconds: number;
  beats: BeatBudget;

  /**
   * Whether the composition opens with the 2s BrandBumper sting. Only
   * long-form 16:9 does — on vertical short-form a logo before the first
   * word loses the scroll, and the brand belongs at the end.
   */
  openWithBumper: boolean;
  musicBed?: MusicBedName;

  dataSource: FormatDataSource;
  mediaSlots: MediaSlotDeclaration[];
  copyFields: CopyFieldDeclaration[];
  thumbnail: ThumbnailDeclaration;
  steps: WizardStep[];
}

/** The render-time subset, which is all the compositions themselves need. */
export interface FormatConfig {
  key: FormatKey;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  openWithBumper: boolean;
  musicBed?: MusicBedName;
}
