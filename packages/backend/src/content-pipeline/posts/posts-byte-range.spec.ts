import { parseByteRange } from './posts-byte-range';

const SIZE = 1000;

describe('parseByteRange serves a satisfiable slice', () => {
  it('parses a closed range', () => {
    expect(parseByteRange('bytes=0-499', SIZE)).toEqual({ start: 0, end: 499 });
  });

  it('parses an open-ended range as through the last byte', () => {
    expect(parseByteRange('bytes=500-', SIZE)).toEqual({
      start: 500,
      end: 999,
    });
  });

  it('parses a suffix range as the final N bytes', () => {
    expect(parseByteRange('bytes=-200', SIZE)).toEqual({
      start: 800,
      end: 999,
    });
  });

  it('clamps an end past the object size', () => {
    expect(parseByteRange('bytes=900-5000', SIZE)).toEqual({
      start: 900,
      end: 999,
    });
  });

  it('clamps a suffix longer than the object', () => {
    expect(parseByteRange('bytes=-5000', SIZE)).toEqual({ start: 0, end: 999 });
  });

  it('accepts a case-insensitive unit and surrounding whitespace', () => {
    expect(parseByteRange('  Bytes=0-9  ', SIZE)).toEqual({ start: 0, end: 9 });
  });
});

describe('parseByteRange falls back to a full 200 response', () => {
  it.each([
    ['a malformed header', 'nonsense'],
    ['a non-byte unit', 'items=0-10'],
    ['an empty spec', 'bytes=-'],
    ['a start past the end of the object', 'bytes=5000-6000'],
    ['an inverted range', 'bytes=500-100'],
    // One slice is served, so honouring only the first part would be a lie.
    ['a multi-range request', 'bytes=0-99,200-299'],
  ])('returns null for %s', (_label, header) => {
    expect(parseByteRange(header, SIZE)).toBeNull();
  });

  it('returns null for a zero-length object', () => {
    expect(parseByteRange('bytes=0-10', 0)).toBeNull();
  });
});
