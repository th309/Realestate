/**
 * The copy step's editing model.
 *
 * The rule that shapes all of this: an operator's own words always win. A
 * regenerate must never quietly overwrite something they typed, because
 * losing wording you liked is far worse than seeing a stale draft — so each
 * field remembers whether a human has touched it.
 *
 * Pure functions, no React, so the merge rules are testable directly.
 */
import type { CopyFieldDeclaration } from "@propertyiq/video-template/formats";

export interface CopyFieldState {
  /** Current text shown in the input. */
  value: string;
  /** Alternatives offered for this field, when it declares variants. */
  options?: string[];
  /** True once a human edits it — suggestions stop overwriting from then on. */
  dirty: boolean;
}

/** fieldId → per-value state. Repeating fields hold one entry per item. */
export type CopyState = Record<string, CopyFieldState[]>;

export function valueCountFor(
  field: CopyFieldDeclaration,
  itemCount: number,
): number {
  if (field.repeating) return Math.max(1, itemCount);
  if (field.variants && field.variants > 1) return 1;
  return 1;
}

export function emptyCopyState(
  fields: readonly CopyFieldDeclaration[],
  itemCount: number,
): CopyState {
  const out: CopyState = {};
  for (const field of fields) {
    out[field.fieldId] = Array.from(
      { length: valueCountFor(field, itemCount) },
      () => ({ value: "", dirty: false }),
    );
  }
  return out;
}

/**
 * Fold a suggestion response into current state.
 *
 * Untouched fields take the draft. Edited fields keep the operator's text
 * but still collect the new alternatives, so regenerating gives them fresh
 * options to choose from without destroying what they wrote.
 */
export function mergeSuggestions(
  state: CopyState,
  suggestions: Record<string, string | string[]>,
  fields: readonly CopyFieldDeclaration[],
): CopyState {
  const next: CopyState = { ...state };

  for (const field of fields) {
    const incoming = suggestions[field.fieldId];
    if (incoming === undefined) continue;

    const current = state[field.fieldId] ?? [];

    // A variants field returns alternatives for ONE value; a repeating field
    // returns one value per item. Same array shape, opposite meaning.
    if (Array.isArray(incoming) && field.variants && field.variants > 1) {
      const existing = current[0] ?? { value: "", dirty: false };
      next[field.fieldId] = [
        {
          value: existing.dirty ? existing.value : (incoming[0] ?? ""),
          options: incoming.filter(Boolean),
          dirty: existing.dirty,
        },
      ];
      continue;
    }

    const values = Array.isArray(incoming) ? incoming : [incoming];
    next[field.fieldId] = current.map((slot, i) => ({
      ...slot,
      value: slot.dirty ? slot.value : (values[i] ?? ""),
    }));
  }

  return next;
}

/** Record an operator edit, marking that value off-limits to regeneration. */
export function setFieldValue(
  state: CopyState,
  fieldId: string,
  index: number,
  value: string,
): CopyState {
  const current = state[fieldId];
  if (!current) return state;
  const next = [...current];
  next[index] = { ...next[index], value, dirty: true };
  return { ...state, [fieldId]: next };
}

/**
 * Choose one of the offered alternatives.
 *
 * Counts as an edit: the operator has made a decision, and a later
 * regenerate should not undo it.
 */
export function chooseVariant(
  state: CopyState,
  fieldId: string,
  option: string,
): CopyState {
  return setFieldValue(state, fieldId, 0, option);
}

/** Resize a repeating field when features are added or removed. */
export function resizeRepeating(
  state: CopyState,
  fields: readonly CopyFieldDeclaration[],
  itemCount: number,
): CopyState {
  const next: CopyState = { ...state };
  for (const field of fields) {
    if (!field.repeating) continue;
    const want = Math.max(1, itemCount);
    const current = next[field.fieldId] ?? [];
    if (current.length === want) continue;
    next[field.fieldId] =
      current.length > want
        ? current.slice(0, want)
        : [
            ...current,
            ...Array.from({ length: want - current.length }, () => ({
              value: "",
              dirty: false,
            })),
          ];
  }
  return next;
}

/**
 * What the run submits: the chosen text, plus the alternatives that were
 * offered and passed over.
 *
 * The rejected hooks are kept deliberately. Per-post metrics already flow
 * into this pipeline, so recording which line was picked out of which set is
 * the difference between "hooks perform differently" and knowing WHICH ones
 * do. It cannot be reconstructed after the fact.
 */
export function toSubmission(
  state: CopyState,
  fields: readonly CopyFieldDeclaration[],
): {
  copy: Record<string, string | string[]>;
  hookVariants?: { chosen: string; rejected: string[] };
} {
  const copy: Record<string, string | string[]> = {};
  let hookVariants: { chosen: string; rejected: string[] } | undefined;

  for (const field of fields) {
    const slots = state[field.fieldId] ?? [];
    copy[field.fieldId] = field.repeating
      ? slots.map((s) => s.value)
      : (slots[0]?.value ?? "");

    if (field.variants && field.variants > 1) {
      const slot = slots[0];
      const offered = slot?.options ?? [];
      if (slot && offered.length > 0) {
        hookVariants = {
          chosen: slot.value,
          rejected: offered.filter((o) => o !== slot.value),
        };
      }
    }
  }

  return { copy, hookVariants };
}
