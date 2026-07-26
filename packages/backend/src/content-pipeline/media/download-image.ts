// packages/backend/src/content-pipeline/media/download-image.ts
//
// Shared, hardened remote-image download for the media source chains (curated
// Wikimedia + Pexels). Timeout, content-type check, and a max-size guard so a
// hostile/huge URL can't hang or blow memory.

const FETCH_TIMEOUT_MS = 30_000;
const MAX_BYTES = 15 * 1024 * 1024;

type FetchFn = typeof fetch;

export interface DownloadedImage {
  bytes: Buffer;
  contentType: string;
}

/** Download a remote image with a timeout, content-type check, and size cap. */
export async function downloadImageBytes(
  url: string,
  fetchImpl: FetchFn = fetch,
): Promise<DownloadedImage> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { Accept: 'image/*' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`unexpected content-type: ${contentType}`);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new Error('image exceeds max size');
    return { bytes, contentType };
  } finally {
    clearTimeout(timer);
  }
}

/** `data:<mime>;base64,<...>` URI for embedding an image in self-contained HTML. */
export function toDataUri(img: DownloadedImage): string {
  return `data:${imageMime(img.contentType)};base64,${img.bytes.toString('base64')}`;
}

/** Normalized image mime (falls back to jpeg for a missing/odd content-type). */
export function imageMime(contentType: string): string {
  return contentType.startsWith('image/') ? contentType : 'image/jpeg';
}

/** File extension for an image content-type (jpg/png/webp/gif; default jpg). */
export function imageExt(contentType: string): string {
  const t = contentType.toLowerCase();
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('gif')) return 'gif';
  return 'jpg';
}

/** Sanitize an id into a safe storage-path segment (lowercased, kebab, capped). */
export function sanitizeStorageSegment(id: string): string {
  const s = String(id ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s.length > 0 ? s : 'option';
}
