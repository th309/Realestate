/**
 * Generates a branded hero image for every blog post and wires it into the
 * post's frontmatter.
 *
 * Before this, 0 of 77 posts had an image and the frontmatter had no field for
 * one, so every blog card rendered as a wall of text.
 *
 * Rendering reuses the content-pipeline's headless-Chromium renderer rather
 * than standing up a second image pipeline — including its base64 font
 * embedding, because production ships Chromium WITHOUT Roboto and a bare font
 * stack silently falls back (reference_content-pipeline-post-image-rendering).
 * Those imports are DYNAMIC, inside main(), so importing this module for the
 * pure spec helpers never loads Puppeteer or Nest.
 *
 * Usage:  npx tsx scripts/content/generate-post-images.ts [--force]
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import matter from "gray-matter";

/**
 * 16:9 — the aspect the blog card grid reserves — expressed as the CSS canvas.
 *
 * The pipeline renderer draws at RENDER_DEVICE_SCALE = 2, so this 640×360 CSS
 * canvas yields a 1280×720 PNG: crisp on retina, and roughly the largest size
 * the card grid ever displays. Authoring at the full pixel size instead would
 * emit 2560×1440 files (~820 KB each, ~63 MB across 77 posts) that next/image
 * would only downscale again.
 */
export const CARD_WIDTH = 640;
export const CARD_HEIGHT = 360;

const OUTPUT_DIR = "public/images/blog";

export interface PostImageSpecInput {
  slug: string;
  title: string;
  category: string;
  headlineValue?: string;
  headlineLabel?: string;
}

export interface PostImageSpec extends PostImageSpecInput {
  /** Repo-relative path the PNG is written to. */
  outputPath: string;
  /** The URL the post's `image:` frontmatter should carry. */
  publicUrl: string;
  width: number;
  height: number;
}

/**
 * Blog frontmatter stores the slug as a ROUTE ("/blog/foo"), but images are
 * written to a flat filename. Stripping the route prefix keeps the PNG out of a
 * phantom nested directory.
 */
export function normaliseSlug(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^\/+/, "")
    .replace(/^blog\//, "")
    .replace(/\/+$/, "");
  if (!cleaned) {
    throw new Error(`Post slug "${raw}" normalises to an empty slug.`);
  }
  return cleaned;
}

export function buildPostImageSpec(input: PostImageSpecInput): PostImageSpec {
  const slug = normaliseSlug(input.slug);
  return {
    ...input,
    slug,
    outputPath: `${OUTPUT_DIR}/${slug}.png`,
    publicUrl: `/images/blog/${slug}.png`,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  };
}

/**
 * A post contributes a headline number ONLY when it states one explicitly in
 * frontmatter. Deliberately no regex-scraping of the description: stamping a
 * mis-parsed figure onto 77 marketing images is a far worse failure than a
 * clean card with no number.
 */
export function readHeadline(data: Record<string, unknown>): {
  headlineValue?: string;
  headlineLabel?: string;
} {
  const value = data.heroStat;
  const label = data.heroStatLabel;
  return {
    headlineValue:
      typeof value === "string" && value.trim() ? value : undefined,
    headlineLabel:
      typeof label === "string" && label.trim() ? label : undefined,
  };
}

/**
 * Palette-quantises the rendered card.
 *
 * PNG stores a smooth gradient badly: the same card is ~300 KB truecolour and
 * ~54 KB as a 256-colour palette, which is 23 MB versus 4 MB across 77 posts.
 * A two-stop brand gradient plus flat text has nowhere near 256 distinct hues,
 * so the quantisation is visually lossless here — verified, no banding.
 */
async function compressCard(png: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(png)
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
}

interface PostFile {
  file: string;
  spec: PostImageSpec;
  hasImage: boolean;
}

function collectPosts(blogDir: string): PostFile[] {
  return readdirSync(blogDir)
    .filter((f) => f.endsWith(".mdx"))
    .map((file) => {
      const raw = readFileSync(join(blogDir, file), "utf8");
      const { data } = matter(raw);
      const slug =
        typeof data.slug === "string" && data.slug.trim()
          ? data.slug
          : file.replace(/\.mdx$/, "");
      const spec = buildPostImageSpec({
        slug,
        title: typeof data.title === "string" ? data.title : slug,
        category:
          typeof data.category === "string" ? data.category : "insights",
        ...readHeadline(data),
      });
      return { file, spec, hasImage: typeof data.image === "string" };
    });
}

/**
 * Rewrites the frontmatter `image:` field textually rather than via
 * matter.stringify, which would reflow and re-quote every other key and produce
 * a 77-file diff of unrelated churn.
 */
function ensureImageFrontmatter(path: string, publicUrl: string): boolean {
  const raw = readFileSync(path, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error(`No frontmatter block in ${path}`);
  if (/^image:\s*/m.test(match[1])) return false;

  const updated = raw.replace(
    /^(---\r?\n[\s\S]*?)(\r?\n---)/,
    `$1\nimage: "${publicUrl}"$2`,
  );
  writeFileSync(path, updated, "utf8");
  return true;
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const root = process.cwd();
  const blogDir = join(root, "content", "blog");
  const outDir = join(root, OUTPUT_DIR);
  mkdirSync(outDir, { recursive: true });

  // Dynamic so the pure exports above stay importable without Puppeteer.
  const assetsPath =
    "../../../backend/src/content-pipeline/post-images/post-image-assets";
  const rendererPath =
    "../../../backend/src/content-pipeline/post-images/post-image-renderer";
  const { fontFaceCss, logoNormalDataUri } = await import(assetsPath);
  const { PuppeteerPostImageRenderer } = await import(rendererPath);
  const { buildPostCardHtml } = await import("./post-card-template");

  const renderer = new PuppeteerPostImageRenderer();
  const fontCss = fontFaceCss();
  // NOT logoReversedDataUri(), despite its "for dark surfaces" doc comment:
  // the two brand assets are swapped relative to their docs. `reversed` is the
  // DARK indigo mark (invisible on this gradient); `normal` is the white mark.
  // post-image-fragments.ts picks by the doc comment and so puts the invisible
  // logo on every dark social card — reported separately, not changed here.
  const logo = logoNormalDataUri();

  const posts = collectPosts(blogDir);
  let rendered = 0;
  let stamped = 0;

  for (const { file, spec, hasImage } of posts) {
    const target = resolve(root, spec.outputPath);
    if (!hasImage || force) {
      const html = buildPostCardHtml(
        {
          title: spec.title,
          category: spec.category,
          headlineValue: spec.headlineValue,
          headlineLabel: spec.headlineLabel,
          width: spec.width,
          height: spec.height,
        },
        fontCss,
        logo,
      );
      const png = await renderer.renderPng(html, spec.width, spec.height);
      writeFileSync(target, await compressCard(png));
      rendered += 1;
    }
    if (ensureImageFrontmatter(join(blogDir, file), spec.publicUrl)) {
      stamped += 1;
    }
    process.stdout.write(`  ${spec.slug}\n`);
  }

  await renderer.onModuleDestroy?.();
  console.log(
    `\n${posts.length} posts · ${rendered} images rendered · ${stamped} frontmatter fields added`,
  );
}

// Only run when invoked directly, never on import from a test.
if (process.argv[1] && process.argv[1].includes("generate-post-images")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
