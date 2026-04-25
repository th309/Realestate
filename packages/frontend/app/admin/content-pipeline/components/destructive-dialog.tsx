"use client";
import { ReactNode, useState } from "react";
import { M3Dialog } from "./m3-dialog";

/**
 * Confirmation dialog for irreversible / destructive actions.
 * State-aware copy is the caller's responsibility — pass title + body
 * tailored to the lifecycle (e.g. "Cancel run" vs "Delete run").
 *
 * Action button is `bg-error text-on-error`. Shows spinner while the
 * onConfirm promise is in-flight; never auto-dismisses on error so the
 * operator can read the failure message.
 */
export function DestructiveDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <M3Dialog open={open} onClose={busy ? () => {} : onClose} ariaLabel={title}>
      <div className="p-6">
        <h2 className="text-xl font-medium text-on-surface mb-3">{title}</h2>
        <div className="text-sm leading-relaxed text-on-surface-variant mb-6">
          {body}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-on-surface hover:bg-on-surface/8 disabled:opacity-50 transition-colors duration-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="px-5 py-2.5 rounded-full text-sm font-medium bg-error text-on-error hover:bg-error/90 disabled:opacity-50 inline-flex items-center gap-2 transition-colors duration-200"
          >
            {busy && (
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border-2 border-on-error/30 border-t-on-error animate-spin"
                aria-hidden
              />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </M3Dialog>
  );
}
