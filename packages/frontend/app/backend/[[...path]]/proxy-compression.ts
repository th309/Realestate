/**
 * Gzip policy for the same-origin backend proxy (`/backend/*`).
 *
 * Railway's edge does not compress, and Next's built-in `compress` does not
 * apply to these route-handler responses (verified in prod 2026-07-11 —
 * identity and gzip requests returned identical byte counts). Without proxy
 * compression, large payloads (e.g. the ~843KB momentum-map heatmap) ship
 * uncompressed to every first-time visitor.
 *
 * Lives beside route.ts (not inside it) because Next validates route-file
 * exports and rejects non-handler symbols.
 */

const COMPRESSIBLE_CONTENT_TYPES =
  /^(application\/(json|javascript|xml|x-ndjson)|text\/|image\/svg)/i;
const MIN_COMPRESS_BYTES = 1024;

function acceptsGzip(acceptEncoding: string | null): boolean {
  const match = /(^|,)\s*gzip\s*(?:;\s*q\s*=\s*([\d.]+))?\s*(?=,|$)/i.exec(
    acceptEncoding ?? "",
  );
  if (!match) return false;
  return match[2] === undefined || parseFloat(match[2]) > 0;
}

export function shouldCompressProxyResponse(
  contentType: string,
  acceptEncoding: string | null,
  byteLength: number,
): boolean {
  // SSE never reaches the buffered path (route.ts returns it early), but the
  // policy refuses it anyway — compressing an event stream buffers it dead.
  if (/text\/event-stream/i.test(contentType)) return false;
  return (
    byteLength >= MIN_COMPRESS_BYTES &&
    COMPRESSIBLE_CONTENT_TYPES.test(contentType) &&
    acceptsGzip(acceptEncoding)
  );
}
