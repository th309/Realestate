"use client";
/**
 * Inline editor for a video-script suggestion.
 *
 * The script IS the payload on this page, so editing happens in the card rather
 * than in a dialog — the operator reads a line they want to change and changes
 * it where they read it. Follows the review queue's post-copy editor: per-field
 * textareas, live counts against the backend's real caps, Esc to back out,
 * Cmd/Ctrl+Enter to save.
 *
 * Everything about which copy shape the row uses is decided in
 * `video-script-edits.ts`; this component only collects text.
 */
import { useState } from "react";
import type { PostCopy } from "../lib/posts-api";
import {
  SCRIPT_FIELD_LIMITS,
  applyVideoScriptEdits,
  closeFieldKey,
  toVideoScriptEdits,
  type VideoScriptEdits,
} from "./video-script-edits";

interface ScriptField {
  key: keyof VideoScriptEdits;
  label: string;
  rows: number;
  hint?: string;
}

const FIELDS: ScriptField[] = [
  {
    key: "title",
    label: "Title",
    rows: 1,
    hint: "Leave blank and the hook is used as the title.",
  },
  { key: "hook", label: "Hook", rows: 2 },
  { key: "body", label: "Body", rows: 7 },
  { key: "close", label: "Close", rows: 2 },
  {
    key: "sceneDirection",
    label: "Scene direction",
    rows: 2,
    hint: "How to shoot or frame it.",
  },
];

export function VideoScriptEditor({
  copy,
  fieldIdPrefix,
  saving,
  onSave,
  onCancel,
}: {
  copy: PostCopy;
  /** Namespaces the field ids — several cards can be open at once. */
  fieldIdPrefix: string;
  saving: boolean;
  onSave: (next: PostCopy) => void;
  onCancel: () => void;
}) {
  const [edits, setEdits] = useState<VideoScriptEdits>(() =>
    toVideoScriptEdits(copy),
  );

  // A legacy row's close text writes back to `cta`, which the backend caps at
  // 500 rather than 2200 — so the limit shown is the one the save will hit.
  const limits = {
    ...SCRIPT_FIELD_LIMITS,
    close: SCRIPT_FIELD_LIMITS[closeFieldKey(copy)],
  };

  // Reachable from generated text that already exceeds a cap: maxLength stops
  // typing past the limit but not loading past it. Name the field rather than
  // let the save fail.
  const overLimitField = FIELDS.find(
    (field) => edits[field.key].length > limits[field.key],
  );

  function save() {
    if (saving || overLimitField) return;
    onSave(applyVideoScriptEdits(copy, edits));
  }

  // Escape backs out, Cmd/Ctrl+Enter saves — the same pair the review queue's
  // copy editor uses.
  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onCancel();
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  }

  return (
    <div className="mt-3 space-y-3" onKeyDown={handleKeyDown}>
      {FIELDS.map((field, index) => {
        const value = edits[field.key];
        const limit = limits[field.key];
        const fieldId = `${fieldIdPrefix}-${field.key}`;
        return (
          <div key={field.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <label
                htmlFor={fieldId}
                className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant"
              >
                {field.label}
              </label>
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  value.length > limit
                    ? "text-error"
                    : "text-on-surface-variant"
                }`}
              >
                {value.length}/{limit}
              </span>
            </div>
            <textarea
              id={fieldId}
              value={value}
              onChange={(event) =>
                setEdits((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
              maxLength={limit}
              rows={field.rows}
              autoFocus={index === 0}
              className="w-full resize-y rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm leading-relaxed text-on-surface transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
            {field.hint && (
              <p className="mt-1 text-[11px] text-on-surface-variant">
                {field.hint}
              </p>
            )}
          </div>
        );
      })}

      {overLimitField && (
        <p role="alert" className="text-xs text-error">
          {overLimitField.label} is{" "}
          {edits[overLimitField.key].length - limits[overLimitField.key]}{" "}
          characters over the limit. Trim it to save.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={saving || overLimitField != null}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full border border-outline-variant px-5 py-2 text-sm font-medium text-on-surface transition-colors duration-200 hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
