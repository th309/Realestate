import { imageExt, imageMime, sanitizeStorageSegment } from '../download-image';

describe('imageMime', () => {
  it('passes an image/* content-type through and defaults odd ones to jpeg', () => {
    expect(imageMime('image/png')).toBe('image/png');
    expect(imageMime('image/webp')).toBe('image/webp');
    expect(imageMime('')).toBe('image/jpeg');
    expect(imageMime('application/octet-stream')).toBe('image/jpeg');
  });
});

describe('imageExt', () => {
  it('maps content-type to a file extension (jpg default)', () => {
    expect(imageExt('image/png')).toBe('png');
    expect(imageExt('image/webp')).toBe('webp');
    expect(imageExt('image/gif')).toBe('gif');
    expect(imageExt('image/jpeg')).toBe('jpg');
    expect(imageExt('image/svg+xml')).toBe('jpg');
  });
});

describe('sanitizeStorageSegment', () => {
  it('lowercases, kebabs, and never returns empty', () => {
    expect(sanitizeStorageSegment('Lou Neff Point')).toBe('lou-neff-point');
    expect(sanitizeStorageSegment('pexels-18441165')).toBe('pexels-18441165');
    expect(sanitizeStorageSegment('!!!')).toBe('option');
    expect(sanitizeStorageSegment('')).toBe('option');
  });
});
