/**
 * The inverse of `normalizeVideoScript` — turning an operator's edits back into
 * a post's `copy` object.
 *
 * Reading a script is easy: `video-script-copy.ts` flattens the structured shape
 * ({title, hook, body, close, sceneDirection, …}) and the legacy shape
 * ({hook, body, cta}) into one display struct. Writing is the hard direction,
 * because the flattened struct has lost which shape it came from, and the copy
 * PATCH replaces the whole `copy` JSONB rather than merging into it. Saving
 * naively would rewrite every legacy row into the structured shape and drop
 * whatever the normalizer never surfaced.
 *
 * React-free so it's unit testable.
 */
import type { PostCopy } from "../lib/posts-api";
import { isValidRunFormat } from "../lib/format-previews";

/**
 * Backend caps for the script fields, mirroring PostCopyDto in
 * packages/backend/src/content-pipeline/posts/dto/update-post.dto.ts. Shown as
 * live counts in the editor rather than discovered as a 400 on save.
 *
 * Note `cta` (500) is capped far lower than `close` (2200): a legacy row's close
 * text lives in `cta`, so the editor's limit depends on which key the save will
 * write. See `closeFieldKey()`.
 */
export const SCRIPT_FIELD_LIMITS = {
  title: 200,
  hook: 300,
  body: 2200,
  close: 2200,
  cta: 500,
  sceneDirection: 500,
} as const;

/** The five script fields the inline editor exposes. */
export interface VideoScriptEdits {
  title: string;
  hook: string;
  body: string;
  close: string;
  sceneDirection: string;
}

/** Keys that only ever appear on the structured shape. */
const STRUCTURED_ONLY_KEYS = [
  "title",
  "close",
  "sceneDirection",
  "durationSeconds",
  "suggestedFormat",
  "suggestedMarketQuery",
] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Whether this copy is already in the structured video_script shape. */
export function isStructuredScriptCopy(copy?: PostCopy | null): boolean {
  if (!copy) return false;
  return STRUCTURED_ONLY_KEYS.some((key) => copy[key] !== undefined);
}

/**
 * Which key an edited close should be written to. The two shapes store the same
 * concept under different names (`close` structured, `cta` legacy) and
 * `normalizeVideoScript` reads them with close-then-cta precedence — so writing
 * follows the key the row already displays from. A row using neither keeps its
 * existing shape rather than being silently upgraded.
 */
export function closeFieldKey(copy?: PostCopy | null): "close" | "cta" {
  if (isNonEmptyString(copy?.close)) return "close";
  if (isNonEmptyString(copy?.cta)) return "cta";
  return isStructuredScriptCopy(copy) ? "close" : "cta";
}

/**
 * Seed the editor from a post's copy. Deliberately NOT built on
 * `normalizeVideoScript`: that fills `title` from the hook (and from the
 * "Untitled script" placeholder) for display, and seeding those would persist a
 * derived title onto a row that never had one. Blank here means blank on the
 * row, and the editor says the hook stands in when title is left empty.
 */
export function toVideoScriptEdits(copy?: PostCopy | null): VideoScriptEdits {
  const source = copy ?? {};
  return {
    title: asText(source.title),
    hook: asText(source.hook),
    body: asText(source.body),
    // Same close-then-cta precedence the normalizer displays with.
    close: isNonEmptyString(source.close) ? source.close : asText(source.cta),
    sceneDirection: asText(source.sceneDirection),
  };
}

/** Write one text field, or remove the key when the edit clears it. */
function writeTextField(copy: PostCopy, key: string, value: string): void {
  const trimmed = value.trim();
  if (trimmed) copy[key] = trimmed;
  else delete copy[key];
}

/**
 * Drop metadata the backend's copy DTO would reject. These fields are written by
 * the model, are not exposed by the editor, and a PATCH replaces the whole copy
 * object — so an untouched-but-invalid value would fail every save with a 400
 * the operator has no way to act on. Text fields are handled the opposite way:
 * the editor shows the cap and blocks the save, because silently truncating
 * someone's script is worse than asking them to trim it.
 */
function dropUnsavableMetadata(copy: PostCopy): void {
  // @IsInt @Min(5) @Max(600) — model output is often fractional (e.g. 45.6).
  const duration = copy.durationSeconds;
  if (duration !== undefined) {
    const rounded =
      typeof duration === "number" && Number.isFinite(duration)
        ? Math.round(duration)
        : Number.NaN;
    if (!Number.isFinite(rounded) || rounded < 5 || rounded > 600) {
      delete copy.durationSeconds;
    } else if (rounded !== duration) {
      copy.durationSeconds = rounded;
    }
  }
  // @IsIn(CONTENT_FORMATS) — the same 10 formats FORMAT_META keys, so anything
  // isValidRunFormat rejects the backend rejects too. Already invisible in the UI.
  if (
    copy.suggestedFormat !== undefined &&
    !isValidRunFormat(copy.suggestedFormat)
  ) {
    delete copy.suggestedFormat;
  }
  // @IsString @MaxLength(120).
  const market = copy.suggestedMarketQuery;
  if (
    market !== undefined &&
    (typeof market !== "string" || market.length > 120)
  ) {
    delete copy.suggestedMarketQuery;
  }
}

/**
 * Apply editor changes to a post's copy. The only place that decides how an edit
 * maps back onto the two copy shapes. Three rules make that mapping safe:
 *
 * 1. **Spread first.** Fields the editor never surfaced (hashtags, slides,
 *    duration, the wizard prefill) are carried through untouched. Narrowing to
 *    the backend's accepted key list happens later, in `toEditableCopy`.
 * 2. **Only changed fields are written.** A field whose text is unchanged is
 *    left exactly as it was, so a round trip through
 *    `applyVideoScriptEdits(copy, toVideoScriptEdits(copy))` leaves the five
 *    editor-exposed text fields byte-identical. This is what stops a legacy
 *    {hook, body, cta} row from being rewritten into the structured shape by the
 *    mere act of saving.
 *
 *    The guarantee is scoped to those text fields, NOT to the whole object:
 *    `dropUnsavableMetadata` still runs unconditionally, so a row carrying a
 *    DTO-invalid `durationSeconds` / `suggestedFormat` / `suggestedMarketQuery`
 *    is corrected even when no field was edited. That is deliberate — those
 *    values are invisible and uneditable, and leaving them would make EVERY
 *    save 400 with an error the operator cannot act on.
 * 3. **Close writes back to the key it came from** (`closeFieldKey`), so a
 *    legacy row stays legacy. When both keys hold text, an edit collapses the
 *    duplicate rather than leaving a shadow value that would resurface the old
 *    text once the winner is cleared.
 *
 * A legacy row does become structured if the operator types a title or scene
 * direction — that is an explicit addition, not a silent conversion.
 */
export function applyVideoScriptEdits(
  copy: PostCopy | null | undefined,
  edits: VideoScriptEdits,
): PostCopy {
  const next: PostCopy = { ...(copy ?? {}) };
  const before = toVideoScriptEdits(copy);

  const changed = (key: keyof VideoScriptEdits) =>
    edits[key].trim() !== before[key].trim();

  if (changed("title")) writeTextField(next, "title", edits.title);
  if (changed("hook")) writeTextField(next, "hook", edits.hook);
  if (changed("body")) writeTextField(next, "body", edits.body);
  if (changed("sceneDirection")) {
    writeTextField(next, "sceneDirection", edits.sceneDirection);
  }

  if (changed("close")) {
    const key = closeFieldKey(copy);
    writeTextField(next, key, edits.close);
    const shadowKey = key === "close" ? "cta" : "close";
    if (isNonEmptyString(next[shadowKey])) delete next[shadowKey];
  }

  dropUnsavableMetadata(next);
  return next;
}
