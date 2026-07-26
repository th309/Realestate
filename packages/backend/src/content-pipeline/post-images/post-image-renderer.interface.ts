// packages/backend/src/content-pipeline/post-images/post-image-renderer.interface.ts

/**
 * Thrown when a card still overflows at the smallest fit scale. The caller two
 * layers up (FeedPostGeneratorService.renderImagesBestEffort) treats it as
 * best-effort (the draft survives with no image) — better a missing image an
 * operator can regenerate than a clipped card shipped to social.
 */
export class PostImageOverflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostImageOverflowError';
  }
}

/**
 * HTML → PNG engine for post images. Behind a Symbol token (mirrors
 * LEAD_MAGNET_RENDERER) so the Puppeteer implementation is swappable in tests /
 * future engines without touching the render service.
 */
export interface PostImageRenderer {
  /** Render a fixed HTML document to a PNG buffer at the given canvas size. */
  renderPng(html: string, width: number, height: number): Promise<Buffer>;

  /**
   * Render with a text-fit guard: draw at full size, then step the whole card
   * DOWN a scale ladder until the copy fits (never clip). Copy is budgeted
   * upstream to fit at the floor; if it STILL overflows at the smallest scale,
   * throw PostImageOverflowError so the caller skips the image best-effort rather
   * than ship a clipped card. `buildHtml(scale)` returns the doc for a --s scale.
   */
  renderFitted(
    buildHtml: (scale: number) => string,
    width: number,
    height: number,
  ): Promise<Buffer>;
}

export const POST_IMAGE_RENDERER = Symbol('PostImageRenderer');
