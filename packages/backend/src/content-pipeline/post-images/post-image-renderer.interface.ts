// packages/backend/src/content-pipeline/post-images/post-image-renderer.interface.ts

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
   * upstream to fit at the floor, so this never truncates — truncation is the
   * absolute backstop in the content builder. `buildHtml(scale)` returns the
   * document for a given --s scale.
   */
  renderFitted(
    buildHtml: (scale: number) => string,
    width: number,
    height: number,
  ): Promise<Buffer>;
}

export const POST_IMAGE_RENDERER = Symbol('PostImageRenderer');
