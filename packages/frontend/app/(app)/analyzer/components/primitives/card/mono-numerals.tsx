import { Fragment } from "react";
import { NUM_CLASS } from "./card-tones";

/**
 * Matches a figure as it appears in analyzer prose: an optional sign (ASCII
 * hyphen, the real minus U+2212, or a plus), an optional currency symbol, a
 * grouped number, an optional decimal, and an optional percent or multiplier
 * suffix. Handles "−$386", "0.74", "−7.3%", "$667,497", "1.25x".
 *
 * Deliberately requires a leading digit after the optional prefix so it does
 * not grab lone symbols, and it does not match years-in-words or ordinals
 * beyond treating them as plain numbers — a mono "30" inside "30-year" is
 * correct here anyway.
 */
const FIGURE = /([−+-]?\$?\d[\d,]*(?:\.\d+)?(?:%|x\b)?)/g;

/**
 * Renders prose with its figures set in the mono face.
 *
 * This is the spec's one typographic signature: the narrative is sans, but
 * every number inside it switches to tabular mono, so the figures a reader is
 * actually scanning for lift off the sentence instead of dissolving into it.
 * Presentation only — the text is unchanged, so it still reads correctly to a
 * screen reader and still copies as plain text.
 */
export function withMonoNumerals(text: string) {
  return text.split(FIGURE).map((part, i) =>
    // split() with one capture group alternates literal, capture, literal…
    // so every odd index is a matched figure.
    i % 2 === 1 ? (
      <span key={i} className={NUM_CLASS}>
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
