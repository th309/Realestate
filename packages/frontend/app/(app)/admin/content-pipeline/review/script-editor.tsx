"use client";
import { useState } from "react";
import { useEditScript } from "../lib/use-run-mutations";

/**
 * Modal script editor for the review queue.
 *
 * The run detail page has a richer inline editor (`runs/[id]/script-panel.tsx`)
 * with a duration meter; this stays modal because the review queue is a
 * keyboard-driven triage flow where the editor is a deliberate interruption and
 * `onSaved` advances to the next item.
 *
 * Saves go through `useEditScript` so the run detail page and the queue both
 * refresh — calling the API directly here meant a save invalidated nothing and
 * raised no toast.
 */
export function ScriptEditor({
  runId,
  variantId,
  initial,
  onClose,
  onSaved,
}: {
  runId: string;
  variantId: "A" | "B";
  initial: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(initial);
  const editScript = useEditScript();

  function save() {
    if (editScript.isPending) return;
    editScript.mutate(
      { id: runId, variantId, fullText: text },
      { onSuccess: () => onSaved() },
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-3xl rounded-[28px] bg-surface p-6 shadow-lg">
        <h3 className="mb-1 font-semibold">Edit script</h3>
        <p className="mb-4 text-sm text-on-surface-variant">
          Saving restarts this run at fact-check.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
          className="h-48 w-full rounded-lg border border-outline-variant p-4 font-mono text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-high"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={editScript.isPending}
            className="rounded-full bg-primary px-6 py-2 font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {editScript.isPending ? "Saving…" : "Save and restart"}
          </button>
        </div>
      </div>
    </div>
  );
}
