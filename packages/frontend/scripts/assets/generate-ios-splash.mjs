#!/usr/bin/env node
/**
 * Generates iOS `apple-touch-startup-image` splash screens.
 *
 * Fallback for `pwa-asset-generator` (which requires downloading Chromium
 * and may not be available in sandboxed/CI environments). Produces a static
 * matrix of the most common iPhone/iPad portrait device-pixel sizes, each a
 * flat brand-surface background with the PropertyIQ mark centered.
 *
 * Run: node scripts/assets/generate-ios-splash.mjs
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, "..", "..");
const SOURCE_LOGO = path.join(FRONTEND_ROOT, "public", "icon-512-maskable.png");
const OUTPUT_DIR = path.join(FRONTEND_ROOT, "public", "splash");

// Brand surface (docs/superpowers/specs/2026-03-27-propertyiq-brand-identity.md, §8.2).
const BACKGROUND_COLOR = "#FAFBFF";

// Portrait device-pixel sizes for the most common iPhone/iPad screens,
// paired with the CSS media-query values Safari uses to select an
// `apple-touch-startup-image` (device-width/device-height/-webkit-device-pixel-ratio).
// One entry per distinct (deviceWidth, deviceHeight, dpr) resolution class —
// many iPhone generations share a class, so this matrix has broader device
// coverage than its 8 rows suggest.
const SPLASH_SIZES = [
  { width: 750, height: 1334, dpr: 2, deviceWidth: 375, deviceHeight: 667 }, // iPhone SE/6/7/8
  { width: 1125, height: 2436, dpr: 3, deviceWidth: 375, deviceHeight: 812 }, // iPhone X/XS/11 Pro/12 mini/13 mini
  { width: 828, height: 1792, dpr: 2, deviceWidth: 414, deviceHeight: 896 }, // iPhone XR/11
  { width: 1170, height: 2532, dpr: 3, deviceWidth: 390, deviceHeight: 844 }, // iPhone 12/12 Pro/13/13 Pro/14
  { width: 1284, height: 2778, dpr: 3, deviceWidth: 428, deviceHeight: 926 }, // iPhone 12/13 Pro Max, 14 Plus
  { width: 1179, height: 2556, dpr: 3, deviceWidth: 393, deviceHeight: 852 }, // iPhone 14 Pro/15/15 Pro/16/16 Pro
  { width: 1290, height: 2796, dpr: 3, deviceWidth: 430, deviceHeight: 932 }, // iPhone 14/15 Pro Max, 15/16 Plus, 16 Pro Max
  { width: 1536, height: 2048, dpr: 2, deviceWidth: 768, deviceHeight: 1024 }, // iPad (portrait)
];

async function generateSplashScreens() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Trim the maskable icon's safe-zone padding down to the actual mark so it
  // can be recomposited at a consistent relative size, rather than inheriting
  // whatever padding the maskable export happens to have.
  const logo = sharp(SOURCE_LOGO).trim();
  const logoBuffer = await logo.toBuffer();

  const results = [];
  for (const size of SPLASH_SIZES) {
    const { width, height } = size;
    const logoWidth = Math.round(width * 0.25);

    const resizedLogo = await sharp(logoBuffer)
      .resize(logoWidth, logoWidth, { fit: "contain" })
      .toBuffer();
    const resizedMeta = await sharp(resizedLogo).metadata();

    const fileName = `apple-splash-${width}-${height}.png`;
    const outputPath = path.join(OUTPUT_DIR, fileName);

    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: BACKGROUND_COLOR,
      },
    })
      .composite([
        {
          input: resizedLogo,
          left: Math.round((width - resizedMeta.width) / 2),
          top: Math.round((height - resizedMeta.height) / 2),
        },
      ])
      .png({ compressionLevel: 9 })
      .toFile(outputPath);

    results.push({ ...size, fileName });
  }

  console.log(`Generated ${results.length} splash screens in ${OUTPUT_DIR}`);
  return results;
}

generateSplashScreens().catch((error) => {
  console.error("Failed to generate iOS splash screens:", error);
  process.exitCode = 1;
});

export { SPLASH_SIZES, BACKGROUND_COLOR };
