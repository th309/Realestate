import { Test } from '@nestjs/testing';
import { AttributionService } from './attribution.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('AttributionService', () => {
  let svc: AttributionService;
  let insertSpy: jest.Mock;

  beforeEach(async () => {
    insertSpy = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      getClient: () => ({ from: () => ({ insert: insertSpy }) }),
    };
    const module = await Test.createTestingModule({
      providers: [
        AttributionService,
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();
    svc = module.get(AttributionService);
  });

  it('writes attribution row with parsed cookie', async () => {
    const cookieValue = JSON.stringify({
      runId: 'run-1',
      slug: 'abcd1234',
      platform: 'youtube_shorts',
      firstTouchAt: '2026-04-20T12:00:00Z',
    });
    await svc.captureFromCookie('user-1', cookieValue, 'free');
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        attributed_run_id: 'run-1',
        attributed_slug: 'abcd1234',
        attributed_platform: 'youtube_shorts',
        first_touch_at: '2026-04-20T12:00:00Z',
        tier_at_signup: 'free',
      }),
    );
  });

  it('defaults first_touch_at to now when missing from cookie', async () => {
    const cookieValue = JSON.stringify({
      runId: 'run-2',
      slug: 'xyz98765',
      platform: 'tiktok',
    });
    await svc.captureFromCookie('user-2', cookieValue, 'pro');
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const inserted = insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof inserted.first_touch_at).toBe('string');
    expect(() => new Date(inserted.first_touch_at as string)).not.toThrow();
    expect(inserted.tier_at_signup).toBe('pro');
  });

  it('no-ops when cookie is null', async () => {
    await svc.captureFromCookie('user-1', null, 'free');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('no-ops when cookie is undefined', async () => {
    await svc.captureFromCookie('user-1', undefined, 'free');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('no-ops when cookie is empty string', async () => {
    await svc.captureFromCookie('user-1', '', 'free');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('no-ops when cookie is malformed JSON', async () => {
    await svc.captureFromCookie('user-1', 'not-json', 'free');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('no-ops when required fields are missing', async () => {
    const missingPlatform = JSON.stringify({
      runId: 'run-1',
      slug: 'abcd1234',
    });
    await svc.captureFromCookie('user-1', missingPlatform, 'free');
    expect(insertSpy).not.toHaveBeenCalled();

    const missingSlug = JSON.stringify({
      runId: 'run-1',
      platform: 'youtube_shorts',
    });
    await svc.captureFromCookie('user-1', missingSlug, 'free');
    expect(insertSpy).not.toHaveBeenCalled();

    const missingRunId = JSON.stringify({
      slug: 'abcd1234',
      platform: 'youtube_shorts',
    });
    await svc.captureFromCookie('user-1', missingRunId, 'free');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('swallows supabase insert errors without throwing', async () => {
    insertSpy.mockResolvedValue({
      error: { message: 'fk violation: attributed_run_id' },
    });
    const cookieValue = JSON.stringify({
      runId: 'run-1',
      slug: 'abcd1234',
      platform: 'youtube_shorts',
      firstTouchAt: '2026-04-20T12:00:00Z',
    });
    await expect(
      svc.captureFromCookie('user-1', cookieValue, 'free'),
    ).resolves.toBeUndefined();
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });
});
