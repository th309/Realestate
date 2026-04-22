import { Test } from '@nestjs/testing';
import { ShortLinkService } from './short-link.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('ShortLinkService', () => {
  let svc: ShortLinkService;
  let insertSingle: jest.Mock;
  let selectSingle: jest.Mock;
  let updateEq: jest.Mock;

  beforeEach(async () => {
    insertSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'link-1',
        slug: 'abcd1234',
        run_id: 'run-1',
        format: 'grade_reveal',
        platform: 'youtube_shorts',
        target_url: '/grade-reveal-signup',
        click_count: 0,
      },
      error: null,
    });
    selectSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'link-1',
        slug: 'abcd1234',
        run_id: 'run-1',
        platform: 'youtube_shorts',
        target_url: '/grade-reveal-signup',
        click_count: 0,
      },
      error: null,
    });
    updateEq = jest.fn().mockResolvedValue({ error: null });

    const supabase = {
      getClient: () => ({
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: insertSingle,
            }),
          }),
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: selectSingle,
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: updateEq,
          }),
        }),
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        ShortLinkService,
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();
    svc = module.get(ShortLinkService);
  });

  it('generateSlug produces 8 url-safe chars', () => {
    const slug = svc.generateSlug();
    expect(slug).toMatch(/^[A-Za-z0-9_-]{8}$/);
  });

  it('generateSlug is unique across 1000 calls', () => {
    const slugs = new Set<string>();
    for (let i = 0; i < 1000; i++) slugs.add(svc.generateSlug());
    expect(slugs.size).toBe(1000);
  });

  it('create inserts a row and returns it', async () => {
    const result = await svc.create({
      runId: 'run-1',
      format: 'grade_reveal',
      platform: 'youtube_shorts',
      targetUrl: '/grade-reveal-signup',
    });
    expect(result.slug).toBe('abcd1234');
    expect(result.id).toBe('link-1');
  });

  it('create retries on unique-violation and eventually fails', async () => {
    insertSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
    await expect(
      svc.create({
        runId: 'run-1',
        format: 'grade_reveal',
        platform: 'youtube_shorts',
        targetUrl: '/grade-reveal-signup',
      }),
    ).rejects.toThrow(/could not generate unique slug/);
    expect(insertSingle).toHaveBeenCalledTimes(5);
  });

  it('create throws immediately on non-unique-violation errors', async () => {
    insertSingle.mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'table missing' },
    });
    await expect(
      svc.create({
        runId: 'run-1',
        format: 'grade_reveal',
        platform: 'youtube_shorts',
        targetUrl: '/grade-reveal-signup',
      }),
    ).rejects.toMatchObject({ code: '42P01' });
    expect(insertSingle).toHaveBeenCalledTimes(1);
  });

  it('resolve returns short-link row and increments click_count', async () => {
    const result = await svc.resolve('abcd1234');
    expect(result?.slug).toBe('abcd1234');
    expect(updateEq).toHaveBeenCalled();
  });

  it('resolve returns null when slug is missing', async () => {
    selectSingle.mockResolvedValue({ data: null, error: null });
    const result = await svc.resolve('missing-slug');
    expect(result).toBeNull();
    expect(updateEq).not.toHaveBeenCalled();
  });
});
