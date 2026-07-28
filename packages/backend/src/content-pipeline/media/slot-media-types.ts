/**
 * What a media slot will accept, and how to decide what an upload really is.
 *
 * Split from the upload service so the allowlist — the security-relevant
 * part — reads on its own, and so the service stays inside the file-size
 * limit as it grows.
 */
import { BadRequestException, Logger } from '@nestjs/common';
import { sniffImageFormat, type SniffedImageFormat } from './image-dimensions';

export type MediaSlotKind = 'image' | 'video';

/** Screenshots and logos. Generous, but nowhere near video territory. */
export const SLOT_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
/** Matches the style-reference video ceiling already in this codebase. */
export const SLOT_VIDEO_MAX_BYTES = 200 * 1024 * 1024;

export interface MediaType {
  kind: MediaSlotKind;
  extension: string;
  maxBytes: number;
  /** Signature the bytes must match when they are identifiable at all. */
  sniffed?: SniffedImageFormat;
}

export const ALLOWED_MEDIA_TYPES: Record<string, MediaType> = {
  'image/png': {
    kind: 'image',
    extension: 'png',
    maxBytes: SLOT_IMAGE_MAX_BYTES,
    sniffed: 'png',
  },
  'image/jpeg': {
    kind: 'image',
    extension: 'jpg',
    maxBytes: SLOT_IMAGE_MAX_BYTES,
    sniffed: 'jpeg',
  },
  'image/webp': {
    kind: 'image',
    extension: 'webp',
    maxBytes: SLOT_IMAGE_MAX_BYTES,
    sniffed: 'webp',
  },
  'video/mp4': {
    kind: 'video',
    extension: 'mp4',
    maxBytes: SLOT_VIDEO_MAX_BYTES,
  },
  'video/quicktime': {
    kind: 'video',
    extension: 'mov',
    maxBytes: SLOT_VIDEO_MAX_BYTES,
  },
};

/**
 * Resolve an upload's true media type, or reject it.
 *
 * The declared Content-Type arrives from the client and is trivially
 * spoofed, so for images it is checked against the actual file signature.
 * Only a POSITIVE contradiction is rejected: bytes we cannot identify are
 * allowed through (logged), because an exotic-but-valid variant failing to
 * parse should not cost an operator a legitimate upload — at worst it fails
 * to render, which is visible and recoverable.
 */
export function resolveMediaType(
  file: { buffer: Buffer; mimetype: string },
  logger: Logger,
): MediaType {
  // Strip any `; charset=` parameter and normalize case before matching.
  const mime = (file.mimetype ?? '').split(';')[0].trim().toLowerCase();
  const mediaType = ALLOWED_MEDIA_TYPES[mime];
  if (!mediaType) {
    throw new BadRequestException(
      `unsupported file type ${file.mimetype || '(none)'} — must be one of ` +
        Object.keys(ALLOWED_MEDIA_TYPES).join(', '),
    );
  }

  if (mediaType.sniffed) {
    const actual = sniffImageFormat(file.buffer);
    if (actual && actual !== mediaType.sniffed) {
      throw new BadRequestException(
        `file contents are ${actual}, not ${mediaType.sniffed} as declared (${mime})`,
      );
    }
    if (!actual) {
      logger.warn(
        `[SLOT] could not identify image signature for declared ${mime}`,
      );
    }
  }

  return mediaType;
}
