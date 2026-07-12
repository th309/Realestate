// Generates public/icon-512-maskable.png from public/icon-512.png.
//
// Android's adaptive icon mask can crop up to ~33% of the edges of a
// maskable icon, so the source mark is scaled down and centered on a
// full-bleed brand background to keep it inside the mask's safe zone.
//
// Usage: node scripts/assets/generate-maskable-icon.mjs

import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../../packages/frontend/public");

const SOURCE_ICON = path.join(publicDir, "icon-512.png");
const OUTPUT_ICON = path.join(publicDir, "icon-512-maskable.png");

const CANVAS_SIZE = 512;
const ICON_SCALE = 0.68; // ~66-70% of canvas, safely inside the adaptive mask's safe zone
const BRAND_PRIMARY = "#3949AB";

async function generateMaskableIcon() {
  const iconSize = Math.round(CANVAS_SIZE * ICON_SCALE);

  const resizedIcon = await sharp(SOURCE_ICON)
    .resize(iconSize, iconSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const offset = Math.round((CANVAS_SIZE - iconSize) / 2);

  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: BRAND_PRIMARY,
    },
  })
    .composite([{ input: resizedIcon, left: offset, top: offset }])
    .png()
    .toFile(OUTPUT_ICON);

  const metadata = await sharp(OUTPUT_ICON).metadata();
  console.log(
    `Generated ${OUTPUT_ICON} (${metadata.width}x${metadata.height}, background ${BRAND_PRIMARY})`,
  );
}

generateMaskableIcon().catch((error) => {
  console.error("Failed to generate maskable icon:", error);
  process.exitCode = 1;
});
