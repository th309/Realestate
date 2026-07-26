// packages/backend/src/content-pipeline/feed/generation-guards.ts
//
// Guards for DeepSeek-routed generation. Project memory: DeepSeek 402 balance
// exhaustion yields a SILENT empty completion (no error thrown), and reasoning
// tokens bill as completion. These helpers turn a silent-empty response into a
// loud error and safely parse the model's JSON output.

/** Thrown when a generation call returns empty/whitespace-only text. */
export class EmptyCompletionError extends Error {
  constructor(context: string) {
    super(
      `Empty completion from generation (${context}). Likely DeepSeek balance (402) exhaustion — check DeepSeek credit.`,
    );
    this.name = 'EmptyCompletionError';
  }
}

/** Assert the model returned non-empty text; otherwise surface a loud error. */
export function assertNonEmptyCompletion(
  text: string | null | undefined,
  context: string,
): asserts text is string {
  if (text == null || text.trim().length === 0) {
    throw new EmptyCompletionError(context);
  }
}

function isNonBlank(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Assert a parsed post copy has real content, not a syntactically-valid-but-blank
 * shape ({}, {"foo":"bar"}, or all-empty strings) — which would otherwise pass
 * JSON parsing, produce zero deterministic-lint violations, and reach
 * pending_review as an empty post. Throws EmptyCompletionError (same treatment as
 * a silent-empty completion) so the cycle records it and moves on.
 *
 * carousel_copy requires a non-blank hook and at least one non-blank slide;
 * every other post type requires a non-blank hook AND body.
 */
export function assertNonBlankPostCopy(
  copy: {
    hook?: unknown;
    body?: unknown;
    title?: unknown;
    close?: unknown;
    sceneDirection?: unknown;
    slides?: Array<{ heading?: unknown; body?: unknown }> | unknown;
  },
  postType: string,
  context: string,
): void {
  if (postType === 'carousel_copy') {
    const slides = Array.isArray(copy.slides) ? copy.slides : [];
    const hasSlide = slides.some(
      (s) => s && (isNonBlank(s.heading) || isNonBlank(s.body)),
    );
    if (!isNonBlank(copy.hook) || !hasSlide) {
      throw new EmptyCompletionError(`blank carousel (${context})`);
    }
    return;
  }
  if (postType === 'video_script') {
    // A complete suggestion needs the full spoken script (hook/body/close) plus
    // a title and scene direction — an incomplete one must not reach review.
    if (
      !isNonBlank(copy.title) ||
      !isNonBlank(copy.hook) ||
      !isNonBlank(copy.body) ||
      !isNonBlank(copy.close) ||
      !isNonBlank(copy.sceneDirection)
    ) {
      throw new EmptyCompletionError(`blank video script (${context})`);
    }
    return;
  }
  if (!isNonBlank(copy.hook) || !isNonBlank(copy.body)) {
    throw new EmptyCompletionError(`blank hook/body (${context})`);
  }
}

/**
 * Parse a JSON object from a model completion, tolerating ```json fences and
 * surrounding prose. Throws if no parseable object is present.
 */
export function parseJsonObject<T = Record<string, unknown>>(
  text: string,
  context: string,
): T {
  assertNonEmptyCompletion(text, context);
  let candidate = text.trim();

  // Strip a leading/trailing code fence if present.
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) candidate = fence[1].trim();

  // Fall back to the first {...} span if there is surrounding prose.
  if (!candidate.startsWith('{')) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      candidate = candidate.slice(start, end + 1);
    }
  }

  try {
    return JSON.parse(candidate) as T;
  } catch (err) {
    throw new Error(
      `Failed to parse JSON from generation (${context}): ${(err as Error).message}`,
    );
  }
}
