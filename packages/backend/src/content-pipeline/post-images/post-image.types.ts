// packages/backend/src/content-pipeline/post-images/post-image.types.ts
//
// Types for the post-images render pipeline: Puppeteer renders a post's copy into
// branded PNG(s), uploads them to the content-pipeline Storage bucket, and records
// media_refs (storing PATHS, not URLs — the posts API signs them on read).

/** Image templates the renderer supports. */
export type PostImageTemplate = 'single_post' | 'carousel_slide';

/** Visual family. `dark` = the proven navy Daily Card; `cream` = editorial infographic. */
export type PostImageFamily = 'dark' | 'cream';

/**
 * Single-post layout variants. The selector picks one by content fit:
 * - `daily_card_stat`  dark, score/stat-forward (hero number + market).
 * - `daily_card_hook`  dark, typographic bold-claim (hook-led, no stat).
 * - `editorial_stat`   cream, Source-Serif headline + big mono stat.
 * - `editorial_claim`  cream, Source-Serif headline claim (no stat).
 */
export type SinglePostVariant =
  | 'daily_card_stat'
  | 'daily_card_hook'
  | 'editorial_stat'
  | 'editorial_claim';

/** Carousel slide role — cover / content / closer differ in treatment. */
export type CarouselSlideRole = 'cover' | 'content' | 'closer';

/** Output dimensions per template. Both are the 4:5 portrait social canvas. */
export const POST_IMAGE_DIMENSIONS: Record<
  PostImageTemplate,
  { width: number; height: number }
> = {
  single_post: { width: 1080, height: 1350 },
  carousel_slide: { width: 1080, height: 1350 },
};

/** Render at 2x for crisp text, then the PNG is downscaled-free retina quality. */
export const RENDER_DEVICE_SCALE = 2;

/**
 * A rendered image reference stored in posts.media_refs. Stores the bucket +
 * `storage_path` (never a signed URL — those expire); the posts API mints
 * short-lived signed URLs from these on list/get. Field name matches
 * PostMediaRef in posts/post.types.ts (the frozen publisher contract).
 */
export interface PostImageMediaRef {
  kind: 'image';
  bucket: string;
  storage_path: string;
  width: number;
  height: number;
  /** 0-based ordering (slide index for carousels; 0 for single_post). */
  order: number;
}

/**
 * A stat rendered on a card — real data only (never invented). `tone` drives the
 * accent color; accent-green is reserved for genuinely positive metrics per brand.
 */
export interface PostImageStat {
  value: string;
  label: string;
  context?: string;
  tone: 'pos' | 'neg' | 'neutral' | 'warn';
}

/**
 * Structured, real-data grounding subset the templates render. A minimal copy of
 * the feed's FeedMarketGrounding, redeclared here so post-images stays decoupled
 * from feed/ (the feed generator maps its grounding into this shape). Numbers are
 * the source of truth for stat cards; the LLM copy supplies the words only.
 */
export interface PostImageGrounding {
  marketName?: string | null;
  state?: string | null;
  score?: number | null;
  /** Momentum word (steady/rising/weak/...) — never a quality grade. */
  scoreLabel?: string | null;
  scoreDelta?: number | null;
  previousScore?: number | null;
  homeValue?: number | null;
  homeValueYoyPct?: number | null;
  rent?: number | null;
  rentYoyPct?: number | null;
  /** Pre-formatted "as of" date for the footer, e.g. "Jun 30, 2026". */
  asOf?: string | null;
}

/** Structured content a template renders. Built from the post's copy + grounding. */
export interface PostImageContent {
  family: PostImageFamily;
  template: PostImageTemplate;
  variant: SinglePostVariant | CarouselSlideRole;
  /** Category pill (single post) — short, uppercase, e.g. "MARKET SIGNAL". */
  category?: string;
  /** Small label above the headline — weekday (dark) / eyebrow (cream). */
  eyebrow?: string;
  /** Large headline (the post hook, or a slide heading). */
  headline: string;
  /** Supporting line under the headline. */
  subhead?: string;
  /** Body paragraph (carousel content slides). */
  body?: string;
  /** CTA / sign-off line. */
  cta?: string;
  /** Hero stat (real data). Present only on stat variants. */
  stat?: PostImageStat;
  /** 1-99 PropertyIQ score to draw on the scale bar (real data). */
  scaleScore?: number | null;
  /** Slide position label for carousels, e.g. "1 / 5". */
  slideLabel?: string;
  /** Footer "as of" date. */
  asOf?: string | null;
}
