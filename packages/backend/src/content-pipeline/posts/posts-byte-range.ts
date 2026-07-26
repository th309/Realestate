// packages/backend/src/content-pipeline/posts/posts-byte-range.ts

/** An inclusive byte range, already clamped to the object's size. */
export interface ByteRange {
  start: number;
  end: number;
}

/**
 * Parse a single-range HTTP `Range: bytes=...` header against a known size.
 *
 * Returns null for anything we should answer with a plain 200: a missing or
 * malformed header, a multi-range request (we serve one slice, so honouring
 * only the first would be a lie), or a range that cannot be satisfied.
 * Supports open-ended (`bytes=500-`) and suffix (`bytes=-500`) forms.
 */
export function parseByteRange(header: string, size: number): ByteRange | null {
  if (size <= 0) return null;
  const match = /^bytes=(.+)$/i.exec(header.trim());
  if (!match) return null;

  const spec = match[1].trim();
  // Multi-range ("bytes=0-99,200-299") needs a multipart body we do not emit.
  if (spec.includes(',')) return null;

  const parts = /^(\d*)-(\d*)$/.exec(spec);
  if (!parts) return null;
  const [, rawStart, rawEnd] = parts;

  if (rawStart === '' && rawEnd === '') return null;

  let start: number;
  let end: number;
  if (rawStart === '') {
    // Suffix form: the last N bytes.
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Number(rawEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    if (start >= size || start < 0 || end < start) return null;
    end = Math.min(end, size - 1);
  }

  return { start, end };
}
