"use client";
import { useState } from "react";
import { NotebookPen } from "lucide-react";
import { PiqCard, PiqCardHeader } from "../primitives/card";

interface NotesSectionProps {
  initialNotes?: string;
  initialShare?: boolean;
  /** Resolves `true` on a genuine save, `false` when the save was guarded or
   *  failed — the button only shows "Saved ✓" on `true`. */
  onSave?: (payload: {
    notes: string;
    shareWithClient: boolean;
  }) => Promise<boolean> | void;
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
  const [saveFailed, setSaveFailed] = useState(false);
  return (
    <PiqCard>
      <section data-notes-section>
        <PiqCardHeader
          icon={<NotebookPen size={13} strokeWidth={2} aria-hidden />}
          tone="violet"
          title="My Notes"
          label={shareWithClient ? "Shared" : "Private"}
        />
        <div className="space-y-3 p-4">
          <textarea
            data-notes-textarea
            value={notes}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setNotes(next);
              setSaved(false);
              setSaveFailed(false);
              onChange?.(next, shareWithClient);
            }}
            placeholder="Add personal observations, follow-up tasks, comp prices…"
            className="min-h-[120px] w-full rounded-[9px] border border-piq-line bg-piq-canvas p-3 text-[13.5px] text-piq-ink placeholder:text-piq-muted focus:border-piq-indigo focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--piq-indigo)_14%,transparent)]"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[12.5px] text-piq-body">
              <input
                data-notes-share
                type="checkbox"
                checked={shareWithClient}
                onChange={(e) => {
                  const next = e.currentTarget.checked;
                  setShareWithClient(next);
                  setSaved(false);
                  setSaveFailed(false);
                  onChange?.(notes, next);
                }}
                className="accent-[var(--piq-indigo)]"
              />
              Share with client (visible in shared link)
            </label>
            <button
              data-notes-save
              onClick={async () => {
                setSaveFailed(false);
                const ok = await onSave?.({ notes, shareWithClient });
                if (ok === false) {
                  setSaveFailed(true);
                } else {
                  setSaved(true);
                }
              }}
              className="rounded-full bg-piq-indigo px-4 py-1.5 text-[12.5px] font-bold text-piq-on-indigo transition-opacity duration-200 hover:opacity-90"
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          </div>
          {saveFailed && (
            <p data-notes-save-error className="text-xs text-piq-red">
              Couldn&apos;t save — make sure this analysis has a property
              address, then try again.
            </p>
          )}
        </div>
      </section>
    </PiqCard>
  );
}
