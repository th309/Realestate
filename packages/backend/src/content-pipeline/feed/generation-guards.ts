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
