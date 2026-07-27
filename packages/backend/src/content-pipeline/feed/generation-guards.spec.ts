import {
  assertNonBlankPostCopy,
  assertNonEmptyCompletion,
  EmptyCompletionError,
  parseJsonObject,
} from './generation-guards';
import type { PostCopy } from '../posts/post.types';

describe('generation guards', () => {
  it('throws EmptyCompletionError on blank completions (DeepSeek 402 silent empty)', () => {
    expect(() => assertNonEmptyCompletion('', 'ctx')).toThrow(
      EmptyCompletionError,
    );
    expect(() => assertNonEmptyCompletion('   \n ', 'ctx')).toThrow(
      EmptyCompletionError,
    );
    expect(() => assertNonEmptyCompletion(null, 'ctx')).toThrow(
      EmptyCompletionError,
    );
  });

  it('passes through non-empty text', () => {
    expect(() => assertNonEmptyCompletion('hi', 'ctx')).not.toThrow();
  });

  it('parses a bare JSON object', () => {
    const out = parseJsonObject<{ hook: string }>('{"hook":"x"}', 'ctx');
    expect(out.hook).toBe('x');
  });

  it('parses JSON wrapped in a ```json fence', () => {
    const text = '```json\n{"body":"hello"}\n```';
    expect(parseJsonObject<{ body: string }>(text, 'ctx').body).toBe('hello');
  });

  it('extracts a JSON object from surrounding prose', () => {
    const text = 'Sure! Here you go: {"cta":"click"} hope that helps';
    expect(parseJsonObject<{ cta: string }>(text, 'ctx').cta).toBe('click');
  });

  it('throws a clear error on unparseable output', () => {
    expect(() => parseJsonObject('not json at all', 'ctx')).toThrow(
      /Failed to parse JSON/,
    );
  });
});

describe('assertNonBlankPostCopy (valid-but-blank JSON guard)', () => {
  it('rejects empty object and blank fields for text posts', () => {
    expect(() => assertNonBlankPostCopy({}, 'linkedin_post', 'ctx')).toThrow(
      EmptyCompletionError,
    );
    expect(() =>
      // double-cast: the fixtures intentionally carry extra/unknown parsed-JSON
      // keys the guard must tolerate — PostCopy itself has no index signature.
      assertNonBlankPostCopy(
        { hook: '', body: '', cta: '', hashtags: [] } as unknown as PostCopy,
        'linkedin_post',
        'ctx',
      ),
    ).toThrow(EmptyCompletionError);
    expect(() =>
      assertNonBlankPostCopy(
        { foo: 'bar' } as unknown as PostCopy,
        'facebook_post',
        'ctx',
      ),
    ).toThrow(EmptyCompletionError);
  });

  it('accepts a text post with non-blank hook and body', () => {
    expect(() =>
      assertNonBlankPostCopy(
        { hook: 'Austin is heating up', body: 'The data shows momentum.' },
        'linkedin_post',
        'ctx',
      ),
    ).not.toThrow();
  });

  it('requires a full video script (title, hook, body, close, sceneDirection)', () => {
    // Missing close + sceneDirection fails even with title + hook + body.
    expect(() =>
      assertNonBlankPostCopy(
        {
          title: 'Austin score reveal',
          hook: 'Austin is heating up',
          body: 'The data shows momentum.',
        },
        'video_script',
        'ctx',
      ),
    ).toThrow(EmptyCompletionError);
    expect(() =>
      assertNonBlankPostCopy(
        {
          title: 'Austin score reveal',
          hook: 'Austin is heating up',
          body: 'The data shows momentum.',
          close: 'Learn more at propertyiq.app',
          sceneDirection: 'Open on a slow push over the skyline.',
        },
        'video_script',
        'ctx',
      ),
    ).not.toThrow();
  });

  it('requires a non-blank hook and at least one real slide for carousels', () => {
    expect(() =>
      assertNonBlankPostCopy(
        { hook: 'Top markets', slides: [{ heading: '', body: '' }] },
        'carousel_copy',
        'ctx',
      ),
    ).toThrow(EmptyCompletionError);
    expect(() =>
      assertNonBlankPostCopy(
        {
          hook: 'Top markets',
          slides: [{ heading: 'Austin', body: 'Score 82' }],
        },
        'carousel_copy',
        'ctx',
      ),
    ).not.toThrow();
  });
});
