"use client";
/**
 * Inline copy editor for a post in the review queue.
 *
 * Edits happen in place, beside the rendered mockup, because the reason to fix
 * copy is almost always something you just spotted in the image. The character
 * counts are the platform's real caps (the backend rejects anything longer), so
 * they're shown rather than discovered on save.
 *
 * Hashtags are typed as plain words: the "#" is noise to type and the publisher
 * adds it back, so it's stripped here and re-rendered on the card.
 */
import { useState } from "react";
import type { PostCopy } from "../lib/posts-api";

/** Field caps, mirroring the backend's copy DTO. */
const LIMITS = { hook: 300, body: 2200, cta: 500 } as const;
const MAX_HASHTAGS = 30;

function hashtagsToText(hashtags: string[] | undefined): string {
  return (hashtags ?? []).map((tag) => tag.replace(/^#/, "")).join(" ");
}

function textToHashtags(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#+/, "").trim())
    .filter(Boolean)
    .slice(0, MAX_HASHTAGS);
}

export function PostCopyEditor({
  copy,
  saving,
  onSave,
  onCancel,
}: {
  copy: PostCopy;
  saving: boolean;
  onSave: (next: PostCopy) => void;
  onCancel: () => void;
}) {
  const [hook, setHook] = useState(copy.hook ?? "");
  const [body, setBody] = useState(copy.body ?? "");
  const [cta, setCta] = useState(copy.cta ?? "");
  const [hashtags, setHashtags] = useState(() => hashtagsToText(copy.hashtags));

  function save() {
    if (saving) return;
    onSave({
      // Spread first so fields this editor doesn't expose (slides, script
      // fields) survive — the backend replaces the whole copy object.
      ...copy,
      hook: hook.trim(),
      body: body.trim(),
      cta: cta.trim(),
      hashtags: textToHashtags(hashtags),
    });
  }

  // Escape backs out, Cmd/Ctrl+Enter saves — the same pair the reject dialog
  // uses. Global review shortcuts already stand down inside form fields.
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
    }
  }

  return (
    <div className="space-y-3" onKeyDown={handleKeyDown}>
      <Field label="Hook" value={hook} limit={LIMITS.hook}>
        <textarea
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          maxLength={LIMITS.hook}
          rows={2}
          autoFocus
          aria-label="Hook"
          className="w-full resize-y rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
      </Field>

      <Field label="Body" value={body} limit={LIMITS.body}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={LIMITS.body}
          rows={6}
          aria-label="Body"
          className="w-full resize-y rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm leading-relaxed text-on-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
      </Field>

      <Field label="Call to action" value={cta} limit={LIMITS.cta}>
        <textarea
          value={cta}
          onChange={(e) => setCta(e.target.value)}
          maxLength={LIMITS.cta}
          rows={2}
          aria-label="Call to action"
          className="w-full resize-y rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
      </Field>

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <label
            htmlFor="post-copy-hashtags"
            className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant"
          >
            Hashtags
          </label>
          <span className="font-mono text-[11px] tabular-nums text-on-surface-variant">
            {textToHashtags(hashtags).length}/{MAX_HASHTAGS}
          </span>
        </div>
        <input
          id="post-copy-hashtags"
          type="text"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
        <p className="mt-1 text-[11px] text-on-surface-variant">
          Separate with spaces. Leave the hash off — it gets added back.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save copy"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full border border-outline-variant px-5 py-2 text-sm font-semibold text-on-surface transition-colors duration-200 hover:bg-surface-container-high disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  limit,
  children,
}: {
  label: string;
  value: string;
  limit: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
          {label}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-on-surface-variant">
          {value.length}/{limit}
        </span>
      </div>
      {children}
    </div>
  );
}
