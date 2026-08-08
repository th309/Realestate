/**
 * Blog hero card template — a standalone HTML document rendered to PNG by the
 * content-pipeline's headless Chromium.
 *
 * Hex literals are correct HERE and only here: this document is rendered by
 * Chromium outside the Next/Tailwind build, so `bg-primary` would resolve to
 * nothing. The values mirror the brand palette in CLAUDE.md §8.2. Every TSX
 * surface still uses semantic tokens.
 *
 * Fonts arrive as a base64 `@font-face` block from the pipeline's
 * post-image-assets, because production ships Chromium WITHOUT Roboto — a bare
 * `font-family: Roboto` stack silently falls back to Liberation Sans
 * (reference_content-pipeline-post-image-rendering).
 */

const BRAND = {
  indigoDeep: "#1A237E",
  indigo: "#3949AB",
  indigoLight: "#C5CAE9",
  accent: "#00C853",
  white: "#FFFFFF",
} as const;

/** Minimal HTML entity escape — titles carry apostrophes, ampersands, quotes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "market-analysis" → "Market Analysis" for the card eyebrow. */
export function formatCategoryLabel(category: string): string {
  return category
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export interface PostCardContent {
  title: string;
  category: string;
  headlineValue?: string;
  headlineLabel?: string;
  width: number;
  height: number;
}

/**
 * Longer titles need a smaller face or they wrap past the card. Deterministic
 * rather than a fit-ladder, since the pipeline's `renderFitted` guard is not
 * available to a plain script run.
 */
export function titleFontSize(title: string): number {
  if (title.length > 110) return 25;
  if (title.length > 80) return 29;
  if (title.length > 55) return 33;
  return 38;
}

export function buildPostCardHtml(
  content: PostCardContent,
  fontFaceCss: string,
  logoDataUri: string,
): string {
  const { title, category, headlineValue, headlineLabel, width, height } =
    content;

  const headlineBlock = headlineValue
    ? `<div class="headline">
         <span class="headline-value">${escapeHtml(headlineValue)}</span>
         ${headlineLabel ? `<span class="headline-label">${escapeHtml(headlineLabel)}</span>` : ""}
       </div>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
${fontFaceCss}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${width}px;height:${height}px}
body{
  font-family:'Roboto',sans-serif;
  background:linear-gradient(135deg,${BRAND.indigoDeep} 0%,${BRAND.indigo} 100%);
  color:${BRAND.white};
  display:flex;flex-direction:column;justify-content:space-between;
  padding:38px 42px;position:relative;overflow:hidden;
}
/* Soft brand glow so the flat gradient reads as designed, not as a fill. */
body::after{
  content:'';position:absolute;right:-85px;top:-85px;
  width:275px;height:275px;border-radius:50%;
  background:radial-gradient(circle,rgba(197,202,233,0.20) 0%,rgba(197,202,233,0) 70%);
}
.eyebrow{
  font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;
  color:${BRAND.accent};
}
.title{
  font-size:${titleFontSize(title)}px;font-weight:700;line-height:1.12;
  letter-spacing:-0.02em;max-width:24ch;
}
.headline{display:flex;flex-direction:column;gap:3px;margin-top:15px}
.headline-value{
  font-family:'Roboto Mono',monospace;font-size:36px;font-weight:500;
  font-variant-numeric:tabular-nums;color:${BRAND.accent};line-height:1;
}
.headline-label{font-size:12px;color:${BRAND.indigoLight}}
.footer{display:flex;align-items:center;gap:8px;position:relative;z-index:1}
.footer img{height:26px;width:auto;display:block}
.footer span{font-size:11px;font-weight:500;color:${BRAND.indigoLight}}
.stack{position:relative;z-index:1;display:flex;flex-direction:column;gap:11px}
</style></head>
<body>
  <div class="stack">
    <span class="eyebrow">${escapeHtml(formatCategoryLabel(category))}</span>
    <h1 class="title">${escapeHtml(title)}</h1>
    ${headlineBlock}
  </div>
  <div class="footer">
    <img src="${logoDataUri}" alt="">
    <span>propertyiq.app</span>
  </div>
</body></html>`;
}
