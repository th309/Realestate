import { NotFoundException } from '@nestjs/common';
import { LateApiError } from './late-client.types';
import {
  isPermanentPublishError,
  renderPostCopy,
  TIKTOK_IMAGE_UNSUPPORTED_MESSAGE,
  YOUTUBE_FAILURE_MESSAGE,
} from './post-publisher.helpers';

describe('post-publisher helpers', () => {
  describe('renderPostCopy', () => {
    it('joins hook/body/cta and normalizes hashtags', () => {
      const text = renderPostCopy({
        hook: 'Big news',
        body: 'Rates dropped.',
        cta: 'DM me',
        hashtags: ['realestate', '#PropertyIQ'],
      });
      expect(text).toBe(
        'Big news\n\nRates dropped.\n\nDM me\n\n#realestate #PropertyIQ',
      );
    });

    it('handles copy with only some fields', () => {
      expect(renderPostCopy({ body: 'Just body' })).toBe('Just body');
      expect(renderPostCopy({})).toBe('');
    });
  });

  describe('isPermanentPublishError', () => {
    it('treats not-found (no connected account) as permanent', () => {
      expect(isPermanentPublishError(new NotFoundException('no acct'))).toBe(
        true,
      );
    });
    it('treats Late 4xx as permanent but 429 as transient', () => {
      expect(isPermanentPublishError(new LateApiError(400, 'bad'))).toBe(true);
      expect(isPermanentPublishError(new LateApiError(429, 'slow down'))).toBe(
        false,
      );
    });
    it('treats Late 5xx and generic errors as transient', () => {
      expect(isPermanentPublishError(new LateApiError(503, 'down'))).toBe(
        false,
      );
      expect(isPermanentPublishError(new Error('network'))).toBe(false);
    });
  });

  it('exposes the honest YouTube failure message', () => {
    expect(YOUTUBE_FAILURE_MESSAGE).toMatch(/video pipeline/);
  });

  it('exposes the honest TikTok image failure message', () => {
    expect(TIKTOK_IMAGE_UNSUPPORTED_MESSAGE).toMatch(/TikTok/);
    expect(TIKTOK_IMAGE_UNSUPPORTED_MESSAGE).toMatch(/manually|consent/i);
  });
});
