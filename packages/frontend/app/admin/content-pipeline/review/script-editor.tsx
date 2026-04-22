"use client";
import { useState } from "react";
import { editScript } from "../lib/content-pipeline-api";

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
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await editScript(runId, variantId, text);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-6">
      <div className="bg-surface rounded-xl p-6 w-full max-w-3xl shadow-lg">
        <h3 className="font-semibold mb-4">Edit script</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-48 rounded-lg border border-outline-variant p-4 font-mono text-sm"
        />
        <div className="flex gap-3 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-primary text-on-primary rounded-full px-6 py-2 font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save and re-check"}
          </button>
        </div>
      </div>
    </div>
  );
}
