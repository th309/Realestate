"use client";

/**
 * DrawerFooter — purely presentational footer for the Customize Thresholds
 * drawer. Contains the inline "Unsaved changes — discard?" confirm strip,
 * the save banner (success / error pill), and the Reset / Cancel / Save
 * action row.
 *
 * Extracted from the shell to honor the 400-line component cap.
 */

import type { BannerState } from "./useDrawerState";

interface DrawerFooterProps {
  banner: BannerState | null;
  confirmCancel: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onResetAll: () => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  isResetting: boolean;
  canSave: boolean;
}

export function DrawerFooter({
  banner,
  confirmCancel,
  onKeepEditing,
  onDiscard,
  onResetAll,
  onCancel,
  onSave,
  isSaving,
  isResetting,
  canSave,
}: DrawerFooterProps) {
  return (
    <>
      {confirmCancel && (
        <div
          data-testid="confirm-cancel-strip"
          role="alert"
          className="px-5 py-2 text-xs flex items-center justify-between border-t border-outline-variant bg-[color-mix(in_oklab,var(--md-warning,#FF8F00)_10%,transparent)] text-on-surface"
        >
          <span>Unsaved changes — discard?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onKeepEditing}
              className="px-2 py-1 rounded-full hover:bg-surface-container"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="px-2 py-1 rounded-full bg-[var(--md-error)] text-on-error"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {banner && (
        <div
          data-testid={`save-banner-${banner.kind}`}
          role={banner.kind === "error" ? "alert" : "status"}
          className={
            "mx-5 mt-2 inline-flex self-start items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border " +
            (banner.kind === "success"
              ? "bg-[color-mix(in_oklab,var(--md-tertiary)_8%,transparent)] text-[var(--md-tertiary)] border-[var(--md-tertiary)]/30"
              : "bg-[color-mix(in_oklab,var(--md-error)_8%,transparent)] text-[var(--md-error)] border-[var(--md-error)]/30")
          }
        >
          {banner.message}
        </div>
      )}

      <footer className="flex items-center justify-between gap-3 px-5 py-4 border-t-[1.75px] border-outline-variant">
        <button
          type="button"
          onClick={onResetAll}
          disabled={isResetting}
          className="text-xs text-[var(--md-primary)] hover:underline disabled:opacity-50"
          data-testid="reset-all-button"
        >
          {isResetting ? "Resetting…" : "Reset all to defaults"}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            data-testid="save-button"
            className="rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </footer>
    </>
  );
}
