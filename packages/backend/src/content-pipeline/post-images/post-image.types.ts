// packages/backend/src/content-pipeline/post-images/post-image.types.ts
//
// Types for the post-images render pipeline: Puppeteer renders a post's copy into
// branded PNG(s), uploads them to the content-pipeline Storage bucket, and records
// media_refs (storing PATHS, not URLs). The admin UI reads images SAME-ORIGIN via
// the posts media streaming endpoint (content blockers filter supabase.co images);
// the publish path signs the paths server-side.

/** Image templates the renderer supports. */
export type PostImageTemplate = 'single_post' | 'carousel_slide';

/**
 * Visual family (the "skin"):
 * - `dark`  = the proven navy Daily Card already live on PropertyIQ socials.
 * - `cream` = the editorial infographic look (Source Serif display).
 * - `white` = the quote-highlight look (pure white, serif, green highlighter stroke).
 * - `photo` = a market skyline photo background + dark gradient (styled like `dark`).
 */
export type PostImageFamily = 'dark' | 'cream' | 'white' | 'photo';

/**
 * Single-post layout variants = skeleton × family. The selector picks one by
 * content fit (real data available) + a deterministic seed so a feed shows a
 * mix and a regenerate cycles to a different look:
 * - `daily_card_stat`   dark,  score/stat-forward (hero number + market).
 * - `daily_card_hook`   dark,  typographic bold-claim (hook-led, no stat).
 * - `daily_card_rows`   dark,  market-row list (name + momentum score chip per row).
 * - `daily_card_versus` dark,  head-to-head two-panel (market A vs market B).
 * - `editorial_stat`    cream, Source-Serif headline + big mono stat.
 * - `editorial_claim`   cream, Source-Serif headline claim (no stat).
 * - `editorial_ranking` cream, Source-Serif ranking list (numbered market rows).
 * - `editorial_versus`  cream, editorial head-to-head two-panel.
 * - `quote_highlight`   white, serif quote with a green highlighter stroke behind
 *                       the emphasized phrase.
 */
export type SinglePostVariant =
  | 'daily_card_stat'
  | 'daily_card_hook'
  | 'daily_card_rows'
  | 'daily_card_versus'
  | 'editorial_stat'
  | 'editorial_claim'
  | 'editorial_ranking'
  | 'editorial_versus'
  | 'quote_highlight'
  | 'photo_hero_stat'
  | 'photo_hero_hook';

/** Layout skeleton — the structural shape a variant renders, independent of skin. */
export type SinglePostSkeleton =
  | 'stat'
  | 'hook'
  | 'claim'
  | 'rows'
  | 'versus'
  | 'quote'
  | 'photo';

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
 * `storage_path` (never a signed URL — those expire); the posts API serves the
 * bytes same-origin on read and the publish path signs the path. Field name
 * matches PostMediaRef in posts/post.types.ts (the frozen publisher contract).
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
 * A rendered video-card MP4 attached to a post. Mirrors PostImageMediaRef —
 * same frozen contract (`storage_path`, never a persisted signed URL) — plus
 * the runtime the review player and the publishers need.
 */
export interface PostVideoMediaRef {
  kind: 'video';
  bucket: string;
  storage_path: string;
  width: number;
  height: number;
  order: number;
  duration_sec: number;
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
 * One market in a row-list / ranking / head-to-head card. Real data only. The
 * chip shows the MOMENTUM word (rising/steady/weak — never an A/F quality grade),
 * and `tone` colors both the score and the chip. `score` is null when a market
 * has no usable number (the row still renders its name with an em-dash).
 */
export interface PostImageRow {
  name: string;
  score: string | null;
  /** Momentum descriptor (e.g. "RISING") — never a letter grade. */
  momentum?: string | null;
  /** Signed score delta, pre-formatted (e.g. "+4") — optional. */
  delta?: string | null;
  tone: PostImageStat['tone'];
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
  /**
   * Real ranked markets for list / head-to-head cards (top movers). Present only
   * when the feed passes the candidate list down; a row/versus variant is picked
   * only when this holds >= 2 entries. Scores are the source of truth; momentum
   * words come from scoreLabel (never a quality grade).
   */
  markets?: Array<{
    name: string;
    state?: string | null;
    score?: number | null;
    scoreLabel?: string | null;
    scoreDelta?: number | null;
  }>;
  /**
   * Full-bleed skyline photo (data URI) for this market, resolved by the feed via
   * MetroPhotoService before render. Present only when a subject-aligned photo was
   * found; the photo-hero look is eligible only when this is set. Server-fetched
   * bytes, never client input — safe to interpolate un-escaped into `<img src>`.
   */
  photoDataUri?: string;
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
  /** Market rows for list / ranking / head-to-head variants (real data). */
  rows?: PostImageRow[];
  /**
   * The phrase inside `headline` to highlight (quote variant): the first
   * occurrence gets the green highlighter stroke behind it. No match = no stroke.
   */
  emphasis?: string;
  /** Attribution / source line under a quote (e.g. "PropertyIQ market intelligence"). */
  attribution?: string;
  /** Full-bleed skyline background as a data URI (photo family) — embedded, offline.
   *  Server-fetched bytes via MetroPhotoService, NEVER client input — safe to
   *  interpolate into `<img src>` un-escaped. */
  photoDataUri?: string;
  /** Slide position label for carousels, e.g. "1 / 5". */
  slideLabel?: string;
  /** Footer "as of" date. */
  asOf?: string | null;
}

/**
 * One single-post layout in the registry: `skeleton` (structural shape) ×
 * `family` (skin) → its build fn. Adding a look = appending an entry plus its
 * build fn — no dispatcher surgery. Lives in types so per-skeleton files can
 * import it without a cycle through post-image-single.ts.
 */
export interface SingleVariantEntry {
  id: SinglePostVariant;
  family: PostImageFamily;
  skeleton: SinglePostSkeleton;
  build: (c: PostImageContent) => string;
}
