// packages/backend/src/content-pipeline/post-images/post-image-renderer.interface.ts

/** Thrown when a card still overflows its canvas after the one shrink retry. */
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
   * Render with a text-fit guard: draw at full size, and if the content overflows
   * the canvas, re-render once at a smaller scale. Throws PostImageOverflowError
   * if it still overflows (caller treats the render as best-effort — never ships
   * a clipped card). `buildHtml(scale)` returns the document for a given --s scale.
   */
  renderFitted(
    buildHtml: (scale: number) => string,
    width: number,
    height: number,
  ): Promise<Buffer>;
}

export const POST_IMAGE_RENDERER = Symbol('PostImageRenderer');
