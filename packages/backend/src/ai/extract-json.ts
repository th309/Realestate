/**
 * Parse a JSON object out of an LLM text response.
 *
 * Models (Claude included) routinely wrap their output in a markdown code fence
 * (```json ... ```) or add a sentence of prose even when told "STRICT JSON
 * only", so a naive `JSON.parse` throws on the backtick and the caller silently
 * falls back. Every AI service that expects a JSON object back should parse
 * through this instead of `JSON.parse`.
 *
 * @throws if no parseable JSON object can be found.
 */
export function extractJsonObject<T = Record<string, unknown>>(
  text: string,
): T {
  const trimmed = (text ?? '').trim();
  if (!trimmed) throw new Error('extractJsonObject: empty response');

  // 1. Fast path: the response is already clean JSON.
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    /* not clean JSON — keep going */
  }

  // 2. Strip a surrounding markdown code fence (```json ... ``` or ``` ... ```).
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim()) as T;
    } catch {
      /* fence content still not parseable — keep going */
    }
  }

  // 3. Last resort: the outermost { ... } span (handles surrounding prose).
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.substring(start, end + 1)) as T;
  }

  throw new Error('extractJsonObject: no JSON object found in response');
}
