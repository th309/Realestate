import {
  POST_IMAGE_SIGNED_URL_TTL_SECONDS,
  signPostMediaRefs,
} from '../post-image-signing';
import type { PostMediaRef } from '../../posts/post.types';

type Call = { bucket: string; path: string; ttl: number };

function fakeClient(
  opts: { url?: string | null; throwIt?: boolean },
  calls: Call[],
) {
  return {
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: (path: string, ttl: number) => {
          calls.push({ bucket, path, ttl });
          if (opts.throwIt) return Promise.reject(new Error('sign boom'));
          return Promise.resolve({
            data: opts.url ? { signedUrl: opts.url } : null,
          });
        },
      }),
    },
  } as never;
}

const imageRef: PostMediaRef = {
  kind: 'image',
  bucket: 'content-pipeline',
  storage_path: 'posts/p1/0.png',
} as PostMediaRef;

describe('signPostMediaRefs', () => {
  it('mints a 1-hour signed url for image refs from storage_path', async () => {
    const calls: Call[] = [];
    const out = await signPostMediaRefs(
      fakeClient({ url: 'https://signed/0.png' }, calls),
      [imageRef],
    );
    expect(out[0]).toMatchObject({ ...imageRef, url: 'https://signed/0.png' });
    expect(calls[0]).toEqual({
      bucket: 'content-pipeline',
      path: 'posts/p1/0.png',
      ttl: POST_IMAGE_SIGNED_URL_TTL_SECONDS,
    });
    expect(POST_IMAGE_SIGNED_URL_TTL_SECONDS).toBe(3600);
  });

  it('passes non-image refs through untouched', async () => {
    const calls: Call[] = [];
    const videoRef = { kind: 'video', url: 'x' } as PostMediaRef;
    const out = await signPostMediaRefs(fakeClient({ url: 'u' }, calls), [
      videoRef,
    ]);
    expect(out[0]).toBe(videoRef);
    expect(calls).toHaveLength(0);
  });

  it('degrades gracefully: a failed sign leaves the ref without a url', async () => {
    const out = await signPostMediaRefs(fakeClient({ throwIt: true }, []), [
      imageRef,
    ]);
    expect(out[0]).toEqual(imageRef);
    expect((out[0] as { url?: string }).url).toBeUndefined();
  });

  it('returns [] for empty / missing media_refs', async () => {
    expect(await signPostMediaRefs(fakeClient({ url: 'u' }, []), [])).toEqual(
      [],
    );
    expect(
      await signPostMediaRefs(fakeClient({ url: 'u' }, []), undefined),
    ).toEqual([]);
  });
});
