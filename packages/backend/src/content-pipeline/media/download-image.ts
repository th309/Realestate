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
  const mime = img.contentType.startsWith('image/')
    ? img.contentType
    : 'image/jpeg';
  return `data:${mime};base64,${img.bytes.toString('base64')}`;
}
