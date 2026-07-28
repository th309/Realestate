import { Injectable, Logger } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { SupabaseService } from '../../supabase/supabase.service';
import { signStoragePath } from '../asset-signing';

const MAX_MIRROR_BYTES = 10 * 1024 * 1024;
const MIRROR_FETCH_TIMEOUT_MS = 10_000;

/** SSRF guard: operator-supplied source URLs must resolve to public hosts. */
function isPrivateAddress(address: string): boolean {
  const v4 = address.startsWith('::ffff:') ? address.slice(7) : address;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const lower = address.toLowerCase();
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80')
  );
}

async function assertPublicHttpsUrl(sourceUrl: string): Promise<void> {
  const parsed = new URL(sourceUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error(`scheme ${parsed.protocol} not allowed`);
  }
  const addresses = isIP(parsed.hostname)
    ? [{ address: parsed.hostname }]
    : await lookup(parsed.hostname, { all: true });
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error(`host resolves to a private address`);
    }
  }
}

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Preview storage for style references. External source URLs (YouTube
 * thumbnails, article images) are hotlink-fragile and blocked by the app's
 * CSP, so on create we mirror the image into the private `content-pipeline`
 * bucket and the card renders a short-lived signed URL instead — the same
 * pattern the video ingest flow uses for its frame strips.
 */
@Injectable()
export class StyleReferencePreviewService {
  private readonly logger = new Logger(StyleReferencePreviewService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Download an external image and store it under
   * `style-references/<userId>/`. Returns the `supabase://` URI, or null if
   * the fetch/upload fails — a missing mirror degrades to no preview, never
   * blocks reference creation.
   */
  async mirrorImageToStorage(
    userId: string,
    sourceUrl: string,
  ): Promise<string | null> {
    try {
      await assertPublicHttpsUrl(sourceUrl);
      // No redirect following: a redirect could hop to a private address
      // after validation. Image CDNs we mirror from serve bytes directly;
      // a redirecting host just degrades to no preview.
      const res = await fetch(sourceUrl, {
        redirect: 'error',
        signal: AbortSignal.timeout(MIRROR_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const contentType = (res.headers.get('content-type') ?? '').split(';')[0];
      const ext = EXT_BY_CONTENT_TYPE[contentType];
      if (!ext) throw new Error(`not an image: ${contentType || 'unknown'}`);

      // Reject oversized bodies before buffering when the server declares a
      // length; the post-buffer check below still covers undeclared bodies.
      const declaredLength = Number(res.headers.get('content-length'));
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > MAX_MIRROR_BYTES
      ) {
        throw new Error(`too large: ${declaredLength} bytes declared`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength > MAX_MIRROR_BYTES) {
        throw new Error(`too large: ${buffer.byteLength} bytes`);
      }

      const path = `style-references/${userId}/${Date.now()}-mirror.${ext}`;
      const { error } = await this.supabase
        .getClient()
        .storage.from('content-pipeline')
        .upload(path, buffer, { contentType, upsert: true });
      if (error) throw error;
      return `supabase://content-pipeline/${path}`;
    } catch (err) {
      this.logger.warn(
        `[STYLE] mirror failed for ${sourceUrl.slice(0, 80)}: ${(err as Error).message.slice(0, 120)}`,
      );
      return null;
    }
  }

  /**
   * Resolve a stored `supabase://bucket/path` preview to a short-lived signed
   * https URL for the browser. Non-supabase values pass through unchanged;
   * signing failures degrade to null rather than failing the list.
   */
  async toSignedPreviewUrl(
    previewStripUrl: string | null,
  ): Promise<string | null> {
    if (!previewStripUrl) return null;
    const match = previewStripUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/);
    if (!match) return previewStripUrl;
    const [, bucket, path] = match;
    try {
      return await signStoragePath(this.supabase.getClient(), bucket, path);
    } catch (err) {
      this.logger.warn(
        `[STYLE] preview sign failed for ${path}: ${(err as Error).message.slice(0, 120)}`,
      );
      return null;
    }
  }
}
