"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Owns the "My Notes" state for the analyzer and the plumbing that lets the
 * NotesSection "Save" button persist through the existing Share/PDF save flow.
 *
 * `AnalyzerHeaderActions` registers a "save now" handle via `registerSave`;
 * the NotesSection Save button calls `saveNotes()`, which invokes that handle.
 * Because notes are controlled here and threaded into the share bundle, they
 * ride along on every snapshot save (NotesSection Save *and* header Share/PDF).
 *
 * Extracted from `AnalyzerClient.tsx` to keep that file under the §1.3
 * 400-line component cap.
 */
export function useAnalyzerNotes(initial?: {
  notes?: string;
  shareNotes?: boolean;
}) {
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [shareNotes, setShareNotes] = useState(initial?.shareNotes ?? false);

  // The save handle published by AnalyzerHeaderActions. Held in a ref so
  // updating it doesn't re-render and so the latest handle is always called.
  const saveRef = useRef<(() => Promise<void>) | null>(null);

  const registerSave = useCallback((saveNow: (() => Promise<void>) | null) => {
    saveRef.current = saveNow;
  }, []);

  const onNotesChange = useCallback((next: string, share: boolean) => {
    setNotes(next);
    setShareNotes(share);
  }, []);

  const saveNotes = useCallback(() => {
    void saveRef.current?.();
  }, []);

  return {
    notes,
    shareNotes,
    registerSave,
    onNotesChange,
    saveNotes,
  };
}
