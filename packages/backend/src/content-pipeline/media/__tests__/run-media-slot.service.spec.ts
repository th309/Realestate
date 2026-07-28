import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  RunMediaSlotService,
  SLOT_IMAGE_MAX_BYTES,
  UploadedSlotAsset,
} from '../run-media-slot.service';
import { probeVideoDimensions } from '../video-dimensions';
import type { SupabaseService } from '../../../supabase/supabase.service';

jest.mock('../video-dimensions', () => ({
  probeVideoDimensions: jest.fn(),
}));

const probeVideoDimensionsMock = probeVideoDimensions as jest.MockedFunction<
  typeof probeVideoDimensions
>;

const RUN_ID = '11111111-1111-4111-8111-111111111111';

/** Minimal PNG carrying a real IHDR so the dimension probe has something to read. */
function pngBuffer(width: number, height: number, padTo = 24): Buffer {
  const buffer = Buffer.alloc(Math.max(24, padTo));
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

/** Minimal JPEG: SOI then an SOF0 frame header carrying the dimensions. */
function jpegBuffer(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(32);
  buffer.writeUInt8(0xff, 0);
  buffer.writeUInt8(0xd8, 1); // SOI
  buffer.writeUInt8(0xff, 2);
  buffer.writeUInt8(0xc0, 3); // SOF0
  buffer.writeUInt16BE(17, 4); // segment length
  buffer.writeUInt8(8, 6); // precision
  buffer.writeUInt16BE(height, 7);
  buffer.writeUInt16BE(width, 9);
  return buffer;
}

/** Minimal lossless WebP: RIFF/WEBP container with a VP8L dimension block. */
function webpBuffer(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(32);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(24, 4);
  buffer.write('WEBP', 8, 'ascii');
  buffer.write('VP8L', 12, 'ascii');
  buffer.writeUInt32LE(10, 16);
  buffer.writeUInt8(0x2f, 20); // VP8L signature
  // width-1 in the low 14 bits, height-1 in the next 14.
  buffer.writeUInt32LE(((height - 1) << 14) | (width - 1), 21);
  return buffer;
}

/** Bytes matching the declared type, so the signature check is satisfied. */
function bufferForMime(mimetype: string): Buffer {
  if (mimetype.startsWith('image/jpeg')) return jpegBuffer(1600, 900);
  if (mimetype.startsWith('image/webp')) return webpBuffer(1600, 900);
  return pngBuffer(1600, 900);
}

function asset(overrides: Partial<UploadedSlotAsset> = {}): UploadedSlotAsset {
  const buffer = overrides.buffer ?? pngBuffer(1600, 900);
  return {
    buffer,
    mimetype: 'image/png',
    originalname: 'dashboard.png',
    size: buffer.length,
    ...overrides,
    // `size` must follow an overridden buffer unless explicitly set.
    ...(overrides.buffer && overrides.size === undefined
      ? { size: overrides.buffer.length }
      : {}),
  };
}

function buildService(
  options: {
    runExists?: boolean;
    previousStorageUrl?: string | null;
    /** More than one row for a slot — the race the service must survive. */
    previousStorageUrlList?: string[];
    uploadError?: { message: string } | null;
  } = {},
) {
  const {
    runExists = true,
    previousStorageUrl = null,
    previousStorageUrlList,
    uploadError = null,
  } = options;

  const previousStorageUrls: string[] =
    previousStorageUrlList ?? (previousStorageUrl ? [previousStorageUrl] : []);

  const inserted: Record<string, unknown>[] = [];
  const deleted: string[][] = [];
  const uploads: { path: string; buffer: Buffer; contentType?: string }[] = [];
  const removals: string[][] = [];

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'content_runs') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: runExists ? { id: RUN_ID } : null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'content_assets') {
        return {
          // The terminal .eq() resolves to a ROW LIST, not .maybeSingle():
          // the service deliberately tolerates duplicate rows for a slot,
          // because maybeSingle() throws on more than one match and would
          // wedge the slot permanently.
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: async () => ({
                  data: previousStorageUrls.map((url: string) => ({
                    storage_url: url,
                  })),
                  error: null,
                }),
              }),
            }),
          }),
          delete: () => ({
            eq: (_c1: string, runId: string) => ({
              eq: (_c2: string, kind: string) => ({
                eq: async (_c3: string, variant: string) => {
                  deleted.push([runId, kind, variant]);
                  return { error: null };
                },
              }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => {
            inserted.push(row);
            return { error: null };
          },
        };
      }
      return {};
    }),
    storage: {
      from: jest.fn(() => ({
        upload: async (
          path: string,
          buffer: Buffer,
          opts?: { contentType?: string },
        ) => {
          uploads.push({ path, buffer, contentType: opts?.contentType });
          return { error: uploadError };
        },
        remove: async (paths: string[]) => {
          removals.push(paths);
          return { error: null };
        },
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://storage.test/signed/${path}` },
          error: null,
        }),
      })),
    },
  };

  const supabase = { getClient: () => client } as unknown as SupabaseService;
  const service = new RunMediaSlotService(supabase);
  return { service, inserted, deleted, uploads, removals, client };
}

beforeEach(() => {
  jest.clearAllMocks();
  probeVideoDimensionsMock.mockResolvedValue({ width: 1080, height: 1920 });
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('RunMediaSlotService rejects file types outside the server-side allowlist', () => {
  it.each([
    ['image/gif', 'a format the renderer cannot place'],
    ['image/svg+xml', 'a vector that could carry script'],
    ['video/webm', 'a container outside the allowlist'],
    ['application/pdf', 'not media at all'],
    ['', 'a client that sent no content type'],
  ])('rejects %s (%s)', async (mimetype) => {
    const { service, uploads } = buildService();
    await expect(
      service.uploadSlotAsset(RUN_ID, 'hero', asset({ mimetype })),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Nothing may reach storage once the type is refused.
    expect(uploads).toHaveLength(0);
  });

  it.each([
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'video/quicktime',
  ])('accepts %s', async (mimetype) => {
    const { service } = buildService();
    await expect(
      service.uploadSlotAsset(
        RUN_ID,
        'hero',
        // Bytes must match the declared type — the signature check below is
        // the whole point, so a fixture that lies would test nothing.
        asset({ mimetype, buffer: bufferForMime(mimetype) }),
      ),
    ).resolves.toMatchObject({ slotId: 'hero' });
  });

  it('rejects bytes that contradict the declared image type', async () => {
    const { service, uploads } = buildService();
    // The multipart Content-Type is client-supplied and trivially spoofed;
    // PNG bytes labelled as JPEG must not be taken at their word.
    await expect(
      service.uploadSlotAsset(
        RUN_ID,
        'hero',
        asset({ mimetype: 'image/jpeg', buffer: pngBuffer(800, 600) }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(uploads).toHaveLength(0);
  });

  it('allows bytes it cannot identify rather than blocking the upload', async () => {
    const { service } = buildService();
    // An exotic-but-valid variant that the header readers cannot parse must
    // not cost an operator a real upload — it degrades to no sourceAspect.
    await expect(
      service.uploadSlotAsset(
        RUN_ID,
        'hero',
        asset({ mimetype: 'image/png', buffer: Buffer.alloc(64, 7) }),
      ),
    ).resolves.toMatchObject({ slotId: 'hero', sourceAspect: null });
  });

  it('ignores a charset parameter and matches on the bare media type', async () => {
    const { service } = buildService();
    await expect(
      service.uploadSlotAsset(
        RUN_ID,
        'hero',
        asset({ mimetype: 'image/PNG; charset=binary' }),
      ),
    ).resolves.toMatchObject({ kind: 'image' });
  });
});

describe('RunMediaSlotService enforces a per-kind size cap', () => {
  it('rejects an image over the image cap even though it is under the video cap', async () => {
    const { service, uploads } = buildService();
    const oversized = asset({
      buffer: pngBuffer(1600, 900, SLOT_IMAGE_MAX_BYTES + 1),
    });
    await expect(
      service.uploadSlotAsset(RUN_ID, 'hero', oversized),
    ).rejects.toThrow(/capped at/);
    expect(uploads).toHaveLength(0);
  });

  it('accepts a video larger than the image cap', async () => {
    const { service } = buildService();
    const bigVideo = asset({
      buffer: Buffer.alloc(SLOT_IMAGE_MAX_BYTES + 1),
      mimetype: 'video/mp4',
    });
    await expect(
      service.uploadSlotAsset(RUN_ID, 'clip', bigVideo),
    ).resolves.toMatchObject({ kind: 'video' });
  });

  it('rejects an empty upload', async () => {
    const { service } = buildService();
    await expect(
      service.uploadSlotAsset(
        RUN_ID,
        'hero',
        asset({ buffer: Buffer.alloc(0) }),
      ),
    ).rejects.toThrow(/empty/);
  });
});

describe('RunMediaSlotService stores the asset and records the slot reference', () => {
  it('returns the slot contract and persists a media_slot row', async () => {
    const { service, uploads, inserted } = buildService();
    const result = await service.uploadSlotAsset(
      RUN_ID,
      'product-hero',
      asset({ buffer: pngBuffer(1600, 900) }),
    );

    expect(result).toEqual({
      url: `https://storage.test/signed/runs/${RUN_ID}/slots/product-hero.png`,
      slotId: 'product-hero',
      kind: 'image',
      sourceAspect: 1600 / 900,
      bytes: 24,
    });

    expect(uploads).toHaveLength(1);
    expect(uploads[0].path).toBe(`runs/${RUN_ID}/slots/product-hero.png`);
    expect(uploads[0].contentType).toBe('image/png');

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      run_id: RUN_ID,
      kind: 'media_slot',
      variant: 'product-hero',
      storage_url: `supabase://content-pipeline/runs/${RUN_ID}/slots/product-hero.png`,
    });
    expect(inserted[0].metadata).toMatchObject({
      slotId: 'product-hero',
      mediaKind: 'image',
      mime: 'image/png',
      sourceAspect: 1600 / 900,
    });
  });

  it('derives sourceAspect for video from the ffprobe display size', async () => {
    probeVideoDimensionsMock.mockResolvedValue({ width: 1080, height: 1920 });
    const { service } = buildService();
    const result = await service.uploadSlotAsset(
      RUN_ID,
      'clip',
      asset({ buffer: Buffer.alloc(2048), mimetype: 'video/quicktime' }),
    );
    expect(probeVideoDimensionsMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      'mov',
    );
    expect(result.sourceAspect).toBeCloseTo(1080 / 1920);
    expect(result.url).toContain(`slots/clip.mov`);
  });

  it('replaces the previous row so one slot never resolves to two assets', async () => {
    const { service, deleted } = buildService({
      previousStorageUrl: `supabase://content-pipeline/runs/${RUN_ID}/slots/hero.png`,
    });
    await service.uploadSlotAsset(RUN_ID, 'hero', asset());
    expect(deleted).toEqual([[RUN_ID, 'media_slot', 'hero']]);
  });

  it('removes the superseded object when a re-upload changes format', async () => {
    const { service, removals } = buildService({
      previousStorageUrl: `supabase://content-pipeline/runs/${RUN_ID}/slots/hero.png`,
    });
    await service.uploadSlotAsset(
      RUN_ID,
      'hero',
      asset({ buffer: Buffer.alloc(2048), mimetype: 'video/mp4' }),
    );
    expect(removals).toEqual([[`runs/${RUN_ID}/slots/hero.png`]]);
  });

  it('recovers a slot that already has duplicate rows', async () => {
    // Two uploads racing the same slot can each delete before either
    // inserts, leaving two rows. Reading that with .maybeSingle() throws,
    // which would wedge the slot forever with no operator recovery. The
    // next upload must instead succeed and collapse it back to one.
    const { service, removals, deleted } = buildService({
      previousStorageUrlList: [
        `supabase://content-pipeline/runs/${RUN_ID}/slots/hero.png`,
        `supabase://content-pipeline/runs/${RUN_ID}/slots/hero.jpg`,
      ],
    });

    await expect(
      service.uploadSlotAsset(
        RUN_ID,
        'hero',
        asset({ buffer: webpBuffer(800, 600), mimetype: 'image/webp' }),
      ),
    ).resolves.toMatchObject({ slotId: 'hero' });

    // Both superseded objects are cleaned up, and the row swap still ran.
    expect(removals).toEqual([
      [`runs/${RUN_ID}/slots/hero.png`, `runs/${RUN_ID}/slots/hero.jpg`],
    ]);
    expect(deleted).toHaveLength(1);
  });

  it('leaves storage alone when a re-upload keeps the same path', async () => {
    const { service, removals } = buildService({
      previousStorageUrl: `supabase://content-pipeline/runs/${RUN_ID}/slots/hero.png`,
    });
    await service.uploadSlotAsset(RUN_ID, 'hero', asset());
    expect(removals).toHaveLength(0);
  });

  it('404s for a run that does not exist', async () => {
    const { service, uploads } = buildService({ runExists: false });
    await expect(
      service.uploadSlotAsset(RUN_ID, 'hero', asset()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(uploads).toHaveLength(0);
  });
});

describe('RunMediaSlotService treats a failed dimension probe as non-fatal', () => {
  it('stores an image with sourceAspect null when the header is unreadable', async () => {
    const { service, uploads, inserted } = buildService();
    // Valid PNG mime, but the bytes carry no readable IHDR.
    const corrupt = asset({ buffer: Buffer.alloc(64, 0x7f) });

    const result = await service.uploadSlotAsset(RUN_ID, 'hero', corrupt);

    expect(result.sourceAspect).toBeNull();
    expect(result.kind).toBe('image');
    expect(result.bytes).toBe(64);
    expect(uploads).toHaveLength(1);
    expect(inserted[0].metadata).toMatchObject({ sourceAspect: null });
  });

  it('stores a video with sourceAspect null when ffprobe throws', async () => {
    probeVideoDimensionsMock.mockRejectedValue(
      new Error('spawn ffprobe ENOENT'),
    );
    const { service, uploads } = buildService();

    const result = await service.uploadSlotAsset(
      RUN_ID,
      'clip',
      asset({ buffer: Buffer.alloc(4096), mimetype: 'video/mp4' }),
    );

    expect(result.sourceAspect).toBeNull();
    expect(result.kind).toBe('video');
    expect(uploads).toHaveLength(1);
  });

  it('stores a video with sourceAspect null when ffprobe reports no stream', async () => {
    probeVideoDimensionsMock.mockResolvedValue(null);
    const { service } = buildService();

    const result = await service.uploadSlotAsset(
      RUN_ID,
      'clip',
      asset({ buffer: Buffer.alloc(4096), mimetype: 'video/mp4' }),
    );

    expect(result.sourceAspect).toBeNull();
  });
});
