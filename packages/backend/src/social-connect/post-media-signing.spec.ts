import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostMediaRef } from '../content-pipeline/posts/post.types';
import {
  POST_IMAGE_SIGNED_URL_TTL_SEC,
  resolvePostMediaUrls,
} from './post-media-signing';

type SignImpl = (
  path: string,
  ttl: number,
) => Promise<{
  data: { signedUrl: string } | null;
  error: { message: string } | null;
}>;

function makeClient(
  sign: SignImpl = async (path, ttl) => ({
    data: { signedUrl: `https://signed.test/${path}?ttl=${ttl}` },
    error: null,
  }),
) {
  const createSignedUrl = jest.fn(sign);
  const from = jest.fn((_bucket: string) => ({ createSignedUrl }));
  const client = { storage: { from } } as unknown as SupabaseClient;
  return { client, from, createSignedUrl };
}

describe('resolvePostMediaUrls', () => {
  it('returns [] for null / empty refs', async () => {
    const { client } = makeClient();
    expect(await resolvePostMediaUrls(client, null)).toEqual([]);
    expect(await resolvePostMediaUrls(client, [])).toEqual([]);
  });

  it('signs storage-backed refs ordered by the `order` field, not array order', async () => {
    const { client, from, createSignedUrl } = makeClient();
    const refs: PostMediaRef[] = [
      {
        kind: 'image',
        bucket: 'content-pipeline',
        path: 'posts/p/2.png',
        order: 2,
      },
      {
        kind: 'image',
        bucket: 'content-pipeline',
        path: 'posts/p/1.png',
        order: 1,
      },
      {
        kind: 'image',
        bucket: 'content-pipeline',
        path: 'posts/p/3.png',
        order: 3,
      },
    ];

    const urls = await resolvePostMediaUrls(client, refs);

    expect(urls).toEqual([
      'https://signed.test/posts/p/1.png?ttl=3600',
      'https://signed.test/posts/p/2.png?ttl=3600',
      'https://signed.test/posts/p/3.png?ttl=3600',
    ]);
    expect(from).toHaveBeenCalledWith('content-pipeline');
    // Signed with the ≥1h TTL, fresh per resolve.
    expect(createSignedUrl).toHaveBeenCalledWith(
      'posts/p/1.png',
      POST_IMAGE_SIGNED_URL_TTL_SEC,
    );
  });

  it('passes through already-public https urls without signing', async () => {
    const { client, createSignedUrl } = makeClient();
    const urls = await resolvePostMediaUrls(client, [
      { kind: 'image', url: 'https://cdn.example/a.png' },
    ]);
    expect(urls).toEqual(['https://cdn.example/a.png']);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('drops non-image refs and refs with no resolvable location', async () => {
    const { client } = makeClient();
    const urls = await resolvePostMediaUrls(client, [
      { kind: 'video', bucket: 'content-pipeline', path: 'posts/p/v.mp4' },
      { kind: 'image', url: 'http://cdn.example/insecure.png' }, // not https
      { kind: 'image' }, // no location at all
      {
        kind: 'image',
        bucket: 'content-pipeline',
        path: 'posts/p/1.png',
        order: 0,
      },
    ]);
    expect(urls).toEqual(['https://signed.test/posts/p/1.png?ttl=3600']);
  });

  it('THROWS when a storage-backed ref cannot be signed (no silent text-only downgrade)', async () => {
    const { client } = makeClient(async () => ({
      data: null,
      error: { message: 'object not found' },
    }));
    await expect(
      resolvePostMediaUrls(client, [
        { kind: 'image', bucket: 'content-pipeline', path: 'posts/p/1.png' },
      ]),
    ).rejects.toThrow(/failed to sign post image/i);
  });

  it('signs FRESH on every call (recovery retries never reuse a stale url)', async () => {
    const { client, createSignedUrl } = makeClient();
    const refs: PostMediaRef[] = [
      { kind: 'image', bucket: 'content-pipeline', path: 'posts/p/1.png' },
    ];
    await resolvePostMediaUrls(client, refs);
    await resolvePostMediaUrls(client, refs);
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });
});
