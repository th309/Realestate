"use client";
import { useState } from "react";

interface NotesSectionProps {
  initialNotes?: string;
  initialShare?: boolean;
  onSave?: (payload: { notes: string; shareWithClient: boolean }) => void;
  /**
   * Fires on every edit so a parent can keep controlled state in sync — this
   * is what lets notes ride along on the header Share/PDF save, not just the
   * NotesSection "Save" button. Optional so the component still works
   * standalone (uncontrolled) in tests / isolation.
   */
  onChange?: (notes: string, shareWithClient: boolean) => void;
}

export function NotesSection({
  initialNotes = "",
  initialShare = false,
  onSave,
  onChange,
}: NotesSectionProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [shareWithClient, setShareWithClient] = useState(initialShare);
  const [saved, setSaved] = useState(false);
  return (
    <section
      data-notes-section
      className="rounded-xl bg-surface border border-outline-variant p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-on-surface">My Notes</h3>
      <textarea
        data-notes-textarea
        value={notes}
        onChange={(e) => {
          const next = e.currentTarget.value;
          setNotes(next);
          setSaved(false);
          onChange?.(next, shareWithClient);
        }}
        placeholder="Add personal observations, follow-up tasks, comp prices…"
        className="w-full min-h-[120px] p-3 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface text-sm"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            data-notes-share
            type="checkbox"
            checked={shareWithClient}
            onChange={(e) => {
              const next = e.currentTarget.checked;
              setShareWithClient(next);
              setSaved(false);
              onChange?.(notes, next);
            }}
          />
          Share with client (visible in shared link)
        </label>
        <button
          data-notes-save
          onClick={() => {
            onSave?.({ notes, shareWithClient });
            setSaved(true);
          }}
          className="rounded-full bg-primary text-on-primary px-4 py-1.5 text-sm font-semibold"
        >
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </section>
  );
}
