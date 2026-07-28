import { readImageDimensions } from '../image-dimensions';

/** Minimal PNG: signature plus the IHDR chunk the parser reads. */
function pngBuffer(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

/** SOI, a JFIF APP0 segment the parser must skip over, then SOF0. */
function jpegBuffer(width: number, height: number): Buffer {
  const app0 = Buffer.alloc(18);
  app0[0] = 0xff;
  app0[1] = 0xe0;
  app0.writeUInt16BE(16, 2);
  app0.write('JFIF', 4, 'ascii');

  const sof0 = Buffer.alloc(10);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sof0.writeUInt16BE(8, 2);
  sof0[4] = 8;
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    app0,
    sof0,
    Buffer.alloc(16),
  ]);
}

function webpLosslessBuffer(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(32);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WEBP', 8, 'ascii');
  buffer.write('VP8L', 12, 'ascii');
  buffer.writeUInt32LE(buffer.length - 20, 16);
  buffer[20] = 0x2f;
  buffer.writeUInt32LE((width - 1) | ((height - 1) << 14), 21);
  return buffer;
}

function webpExtendedBuffer(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(32);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WEBP', 8, 'ascii');
  buffer.write('VP8X', 12, 'ascii');
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

describe('readImageDimensions reads each allowed image format', () => {
  it('reads width and height from a PNG IHDR chunk', () => {
    expect(readImageDimensions(pngBuffer(1600, 900))).toEqual({
      width: 1600,
      height: 900,
    });
  });

  it('walks past a JPEG APP0 segment to reach the start-of-frame size', () => {
    expect(readImageDimensions(jpegBuffer(1284, 2778))).toEqual({
      width: 1284,
      height: 2778,
    });
  });

  it('reads a lossless WebP canvas size', () => {
    expect(readImageDimensions(webpLosslessBuffer(2560, 1440))).toEqual({
      width: 2560,
      height: 1440,
    });
  });

  it('reads an extended WebP canvas size', () => {
    expect(readImageDimensions(webpExtendedBuffer(1080, 1920))).toEqual({
      width: 1080,
      height: 1920,
    });
  });
});

describe('readImageDimensions returns null instead of throwing on bad input', () => {
  it('returns null for an empty buffer', () => {
    expect(readImageDimensions(Buffer.alloc(0))).toBeNull();
  });

  it('returns null for bytes that match no supported signature', () => {
    expect(readImageDimensions(Buffer.from('not an image at all'))).toBeNull();
  });

  it('returns null for a PNG signature with a truncated IHDR', () => {
    const truncated = pngBuffer(800, 600).subarray(0, 18);
    expect(readImageDimensions(truncated)).toBeNull();
  });

  it('returns null for a PNG declaring a zero dimension', () => {
    expect(readImageDimensions(pngBuffer(0, 600))).toBeNull();
  });

  it('returns null for a JPEG whose markers end before a frame header', () => {
    // SOI followed immediately by EOI: no SOF segment ever appears.
    const noFrame = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      Buffer.alloc(24),
    ]);
    expect(readImageDimensions(noFrame)).toBeNull();
  });

  it('returns null for a WebP with an unrecognized bitstream chunk', () => {
    const buffer = webpLosslessBuffer(640, 480);
    buffer.write('XXXX', 12, 'ascii');
    expect(readImageDimensions(buffer)).toBeNull();
  });
});
