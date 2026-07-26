// packages/backend/src/content-pipeline/post-images/post-image-assets.ts
//
// Loads the bundled fonts + logomarks once and exposes them as inlineable
// data-URIs. Production backend images ship only Liberation Sans (see
// Dockerfile.backend) — NO Roboto — so a `font-family: Roboto` stack would
// silently fall back and violate the post-worthy bar. Embedding the woff2 as
// base64 @font-face keeps every render self-contained and offline (no network,
// no host fonts). The .woff2/.png files MUST be listed in nest-cli.json `assets`
// or prod ENOENTs (reference_nest-build-assets).

import { readFileSync } from 'fs';
import { join } from 'path';

const ASSET_DIR = join(__dirname, 'assets');

/** Roboto + Roboto Mono + Source Serif 4 are Google's latin-subset variable
 *  woff2 (weight axis intact — real 300/400/500/700, not synthetic). */
function fontDataUri(file: string): string {
  const bytes = readFileSync(join(ASSET_DIR, 'fonts', file));
  return `data:font/woff2;base64,${bytes.toString('base64')}`;
}

function pngDataUri(file: string): string {
  const bytes = readFileSync(join(ASSET_DIR, 'brand', file));
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

let cachedFontFaceCss: string | null = null;
let cachedLogoReversed: string | null = null;
let cachedLogoNormal: string | null = null;

/**
 * The `@font-face` block, inlined at the top of every template's <style>.
 * Variable fonts declared across their weight range so 300/400/500/700 all
 * render as real masters. Cached after first read.
 */
export function fontFaceCss(): string {
  if (cachedFontFaceCss) return cachedFontFaceCss;
  const roboto = fontDataUri('roboto-latin.woff2');
  const robotoMono = fontDataUri('roboto-mono-latin.woff2');
  const sourceSerif = fontDataUri('source-serif-latin.woff2');
  cachedFontFaceCss = `
    @font-face{font-family:'Roboto';font-style:normal;font-weight:100 900;src:url(${roboto}) format('woff2');}
    @font-face{font-family:'Roboto Mono';font-style:normal;font-weight:100 700;src:url(${robotoMono}) format('woff2');}
    @font-face{font-family:'Source Serif 4';font-style:normal;font-weight:200 900;src:url(${sourceSerif}) format('woff2');}
  `;
  return cachedFontFaceCss;
}

/** White PIQ shortmark (for dark surfaces). */
export function logoReversedDataUri(): string {
  if (!cachedLogoReversed)
    cachedLogoReversed = pngDataUri('piq-shortmark-reversed.png');
  return cachedLogoReversed;
}

/** Indigo PIQ shortmark (for light / cream surfaces). */
export function logoNormalDataUri(): string {
  if (!cachedLogoNormal)
    cachedLogoNormal = pngDataUri('piq-shortmark-normal.png');
  return cachedLogoNormal;
}
