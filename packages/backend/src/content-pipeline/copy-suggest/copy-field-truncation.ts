/**
 * Making a suggested line safe to put on screen.
 *
 * Two jobs, both of which have to happen after the model answers rather than
 * only in the prompt. A hook that overruns its box is not "slightly long", it
 * is unusable — it clips or reflows over the footage — and a model asked for
 * 90 characters will sometimes hand back 104. And house prose rules for
 * broadcast copy (no markdown, no em-dashes, no underscores, no code
 * identifiers) are cheap to enforce mechanically and unreliable to enforce by
 * asking.
 *
 * Both operations only ever REMOVE or normalize characters the model wrote.
 * Neither invents words, which matters: an operator edits what they are shown,
 * so anything added here would ship as if a person had approved it.
 */

/** Characters that read as unfinished when a truncation lands on them. */
const TRAILING_PUNCTUATION = /[\s,;:.!?\-–—/&|]+$/;

/**
 * Strip formatting the model was told not to use but sometimes emits anyway.
 * On-screen text is plain text: there is no renderer for an asterisk.
 */
export function sanitizeOnScreenCopy(raw: string): string {
  return (
    raw
      // Fenced/inline code fences first, so their contents survive as words.
      .replace(/```+/g, ' ')
      .replace(/`/g, '')
      // Markdown emphasis, headings, blockquotes, and list bullets.
      .replace(/\*+/g, '')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s{0,3}[-+]\s+/gm, '')
      // Em/en dashes read as a pause; a comma is the spoken equivalent.
      .replace(/\s*[—–]\s*/g, ', ')
      // Underscores appear as snake_case identifiers or as stray emphasis.
      .replace(/_+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export interface TruncationOutcome {
  value: string;
  /** True when characters were dropped to fit maxLength. */
  truncated: boolean;
  originalLength: number;
}

/**
 * Fit `text` into `maxLength`, cutting at a word boundary.
 *
 * A mid-word cut ("Know a market in 10 sec") looks like a bug to whoever
 * reads it, so the cut moves back to the last space. When a single word is
 * itself longer than the limit there is no boundary to find and the hard cut
 * is the only option left — rare, and still better than overflowing.
 */
export function truncateAtWordBoundary(
  text: string,
  maxLength: number,
): TruncationOutcome {
  const originalLength = text.length;
  if (maxLength <= 0) {
    return { value: '', truncated: originalLength > 0, originalLength };
  }
  if (originalLength <= maxLength) {
    return { value: text, truncated: false, originalLength };
  }

  const clipped = text.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  const atBoundary = lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped;

  return {
    value: atBoundary.replace(TRAILING_PUNCTUATION, ''),
    truncated: true,
    originalLength,
  };
}

/** Sanitize then fit, which is the order that matters: sanitizing can shorten. */
export function prepareFieldValue(
  raw: unknown,
  maxLength: number,
): TruncationOutcome {
  if (typeof raw !== 'string') {
    return { value: '', truncated: false, originalLength: 0 };
  }
  return truncateAtWordBoundary(sanitizeOnScreenCopy(raw), maxLength);
}
