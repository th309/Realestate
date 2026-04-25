"use client";
import { KEYBINDINGS } from "./keybindings";

/**
 * Sticky bottom action bar for the review card. Each button shows its
 * keyboard binding as an inline kbd chip — single source of truth lives in
 * KEYBINDINGS so the cheatsheet and these buttons can never drift apart.
 *
 * Approve is primary (filled). Reject and Delete use a low-emphasis error
 * style (tinted background + error text) so destructive actions read as
 * destructive without screaming red across the whole bar.
 */
export function ActionBar({
  approving,
  deleteLabel,
  onApprove,
  onEdit,
  onThumbnail,
  onReject,
  onSkip,
  onDelete,
  onCheatsheet,
}: {
  approving: boolean;
  deleteLabel: string;
  onApprove: () => void;
  onEdit: () => void;
  onThumbnail: () => void;
  onReject: () => void;
  onSkip: () => void;
  onDelete: () => void;
  onCheatsheet: () => void;
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-10 border-t border-outline-variant bg-surface-container-low backdrop-blur-md">
      <div className="px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ActionButton
            primary
            kbd={KEYBINDINGS.approve.display}
            label="Approve"
            onClick={onApprove}
            busy={approving}
          />
          <ActionButton
            kbd={KEYBINDINGS.edit.display}
            label="Edit script"
            onClick={onEdit}
          />
          <ActionButton
            kbd={KEYBINDINGS.thumbnail.display}
            label="Thumbnail"
            onClick={onThumbnail}
          />
          <ActionButton
            kbd={KEYBINDINGS.reject.display}
            label="Reject"
            onClick={onReject}
            tone="error"
          />
          <ActionButton
            kbd={KEYBINDINGS.skip.display}
            label="Skip"
            onClick={onSkip}
          />
          <ActionButton
            kbd={KEYBINDINGS.delete.display}
            label={deleteLabel}
            onClick={onDelete}
            tone="error"
          />
        </div>
        <button
          type="button"
          onClick={onCheatsheet}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors duration-200 inline-flex items-center justify-center text-lg font-mono"
        >
          ?
        </button>
      </div>
    </div>
  );
}

function ActionButton({
  kbd,
  label,
  onClick,
  primary,
  tone,
  busy,
}: {
  kbd: string;
  label: string;
  onClick: () => void;
  primary?: boolean;
  tone?: "error";
  busy?: boolean;
}) {
  const palette = primary
    ? "bg-primary text-on-primary hover:bg-primary/90"
    : tone === "error"
      ? "bg-error/10 text-error hover:bg-error/15"
      : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`${palette} rounded-full px-4 py-2 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 transition-colors duration-200`}
    >
      <kbd className="font-mono text-[10px] font-bold opacity-80">{kbd}</kbd>
      <span>{label}</span>
      {busy && (
        <span
          className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin"
          aria-hidden
        />
      )}
    </button>
  );
}
