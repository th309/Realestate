import {
  assertNonEmptyCompletion,
  EmptyCompletionError,
  parseJsonObject,
} from './generation-guards';

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
